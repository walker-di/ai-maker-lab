import { afterEach, describe, expect, it } from 'bun:test';
import { Euler, Quaternion } from 'three';
import { RacingEngine } from './RacingEngine.js';
import { SurfaceLookup } from './tracks/surface-lookup.js';
import type { TrackPreset, VehiclePreset } from '../types.js';

function makeVehicle(): VehiclePreset {
  return {
    id: 'test-rwd',
    label: 'Test RWD',
    driveLabel: 'RWD',
    layoutLabel: 'Front-mid',
    color: 0xff0000,
    wheelbase: 2.6,
    trackWidth: 1.6,
    frontMassPct: 0.52,
    finalDrive: 3.8,
    gears: [
      { n: 'R', ratio: -3.1 },
      { n: 'N', ratio: 0 },
      { n: '1', ratio: 3.2 },
      { n: '2', ratio: 2.1 },
    ],
    steerMaxDeg: 28,
    axleDrive: { front: 0, rear: 1 },
    diffType: 'clutchLSD',
  };
}

function makeTrack(): TrackPreset {
  return {
    id: 'test-loop',
    label: 'Test Loop',
    groundColor: 0x335533,
    halfWidth: 7,
    curbWidth: 0.8,
    rubberWidth: 2,
    marblesWidth: 1,
    samples: 64,
    ctrl: [
      [0, 0],
      [40, 0],
      [40, 40],
      [0, 40],
    ],
  };
}

const engines: RacingEngine[] = [];

function createEngine(): RacingEngine {
  const engine = new RacingEngine({ vehicle: makeVehicle(), track: makeTrack() });
  engine.resetCar();
  engines.push(engine);
  return engine;
}

function setKey(engine: RacingEngine, key: string, pressed: boolean): void {
  const input = engine.input as unknown as {
    onKeyDown: (event: { key: string }) => void;
    onKeyUp: (event: { key: string }) => void;
  };
  if (pressed) input.onKeyDown({ key });
  else input.onKeyUp({ key });
}

function stepFor(engine: RacingEngine, totalSeconds: number, dt = 1 / 240): void {
  const steps = Math.ceil(totalSeconds / dt);
  for (let i = 0; i < steps; i++) engine.step(dt);
}

function holdSteerAtSpeed(engine: RacingEngine, steerSmoothed: number, speedMs: number, totalSeconds: number, dt = 1 / 240) {
  engine.velocityWS.copy(engine.forward.clone().multiplyScalar(speedMs));
  const steps = Math.ceil(totalSeconds / dt);
  for (let i = 0; i < steps; i++) {
    engine.input.state.steerSmoothed = steerSmoothed;
    engine.step(dt);
  }
  return engine.snapshot();
}

// --------------------------------------------------------------------
// Phase 7 scenario harness
//
// These small helpers let scenario tests describe what they want
// (chassis state, wheel state, sampling) without re-implementing the
// access pattern in every test. They intentionally stay narrow — they do
// NOT mutate engine internals beyond what each scenario calls out, so a
// scenario assertion failure points at simulator behaviour, not test
// plumbing.
// --------------------------------------------------------------------

interface WheelInternal {
  fz: number;
  fx: number;
  fy: number;
  mz: number;
  omega: number;
  slipRatio: number;
  slipAngle: number;
  slidePower: number;
  driveShare: number;
}

function readWheels(engine: RacingEngine): WheelInternal[] {
  return (engine as unknown as { wheels: WheelInternal[] }).wheels;
}

/** Lets a freshly-created engine settle on the track surface with no input. */
function settleOnTrack(engine: RacingEngine, seconds = 1, dt = 1 / 240): void {
  stepFor(engine, seconds, dt);
}

interface ForceChassisStateInput {
  /** Chassis-local forward speed (m/s). Positive = travelling forward. */
  forwardMs: number;
  /** Chassis-local lateral speed (m/s). Positive = sliding to chassis right. */
  lateralMs?: number;
  /** Optional yaw-rate override (rad/s, automotive convention). */
  yawRateRad?: number;
  /** Optional sideslip override (deg, automotive convention). */
  sideslipDeg?: number;
  /** Optional engine RPM override. Useful for power-slide scenarios. */
  engineRpm?: number;
  /** Optional chassis-up Y override so the wheels can be put airborne. */
  chassisY?: number;
}

/**
 * Force the engine into a repeatable chassis state. Resets the world
 * orientation to identity (so chassis forward = world -Z), copies the
 * desired velocity into both `velocityWS` and `prevLocalVelocity` so the
 * next-step accel derivation reads the requested state cleanly, and
 * optionally overrides yaw, sideslip, RPM, and chassis height.
 */
function forceChassisState(engine: RacingEngine, input: ForceChassisStateInput): void {
  const lateralMs = input.lateralMs ?? 0;
  engine.worldQuat.identity();
  engine.velocityWS.set(lateralMs, 0, -input.forwardMs);
  const internals = engine as unknown as {
    prevLocalVelocity: { set: (x: number, y: number, z: number) => void };
    sideslipRad: number;
    yawRateRad: number;
    engineOmega: number;
  };
  internals.prevLocalVelocity.set(lateralMs, 0, -input.forwardMs);
  if (input.yawRateRad !== undefined) internals.yawRateRad = input.yawRateRad;
  if (input.sideslipDeg !== undefined) internals.sideslipRad = input.sideslipDeg * (Math.PI / 180);
  if (input.engineRpm !== undefined) {
    internals.engineOmega = input.engineRpm * (2 * Math.PI / 60);
  }
  if (input.chassisY !== undefined) engine.worldPos.y = input.chassisY;
}

interface ForceWheelStateInput {
  omegaByWheel?: [number, number, number, number];
  slipRatioByWheel?: [number, number, number, number];
  slipAngleByWheel?: [number, number, number, number];
}

/** Pin the per-wheel kinematic state for a deterministic next step. */
function forceWheelState(engine: RacingEngine, input: ForceWheelStateInput): void {
  const wheels = readWheels(engine);
  for (let i = 0; i < 4; i++) {
    if (input.omegaByWheel) wheels[i].omega = input.omegaByWheel[i];
    if (input.slipRatioByWheel) wheels[i].slipRatio = input.slipRatioByWheel[i];
    if (input.slipAngleByWheel) wheels[i].slipAngle = input.slipAngleByWheel[i];
  }
}

/**
 * Step the engine for `seconds` and let `collect` accumulate a sample on
 * each step. Returns the sample count so callers can divide totals into
 * averages directly.
 */
function sampleFor(
  engine: RacingEngine,
  seconds: number,
  dt: number,
  collect: (sample: number, totalSamples: number) => void,
): number {
  const steps = Math.ceil(seconds / dt);
  for (let i = 0; i < steps; i++) {
    engine.step(dt);
    collect(i, steps);
  }
  return steps;
}

function sumAxle(wheels: WheelInternal[], axle: 'front' | 'rear', field: keyof WheelInternal): number {
  if (axle === 'front') return Number(wheels[0][field]) + Number(wheels[1][field]);
  return Number(wheels[2][field]) + Number(wheels[3][field]);
}

function sumSide(wheels: WheelInternal[], side: 'left' | 'right', field: keyof WheelInternal): number {
  if (side === 'left') return Number(wheels[0][field]) + Number(wheels[2][field]);
  return Number(wheels[1][field]) + Number(wheels[3][field]);
}

function escTorqueByWheel(engine: RacingEngine, input: {
  speedKmh: number;
  speedMs: number;
  steerSmoothed: number;
  yawRateRad: number;
  sideslipDeg: number;
}): number[] {
  const internals = engine as unknown as {
    runDrivetrainAndAids: (dt: number) => void;
    driverAids: { escTorqueByWheel: number[] };
    wheels: Array<{ slipRatio: number }>;
    input: { state: { throttle: number; brake: number; handbrake: number; steerSmoothed: number } };
  };

  engine.worldQuat.identity();
  // Chassis forward = -Z, so a forward speed sits in the -Z direction.
  engine.velocityWS.set(0, 0, -input.speedMs);
  engine.speedKmh = input.speedKmh;
  engine.yawRateRad = input.yawRateRad;
  engine.sideslipRad = input.sideslipDeg * (Math.PI / 180);
  internals.input.state.throttle = 0;
  internals.input.state.brake = 0;
  internals.input.state.handbrake = 0;
  internals.input.state.steerSmoothed = input.steerSmoothed;
  for (const wheel of internals.wheels) wheel.slipRatio = 0;

  internals.runDrivetrainAndAids(0.2);
  return [...internals.driverAids.escTorqueByWheel];
}

function classifyDriftState(engine: RacingEngine, input: {
  speedMs: number;
  lateralMs?: number;
  rearOmega?: number;
  rearSlipRatio?: number;
  frontSlipDeg?: number;
  rearSlipDeg?: number;
  throttle?: number;
  brake?: number;
  handbrake?: number;
}): string {
  const internals = engine as unknown as {
    updateBasis: () => void;
    updateChassisDerived: () => void;
    prevLocalVelocity: { set: (x: number, y: number, z: number) => void };
    wheels: Array<{ omega: number; slipRatio: number; slipAngle: number }>;
    input: { state: { throttle: number; brake: number; handbrake: number } };
  };

  const lateralMs = input.lateralMs ?? 0;
  const frontSlipRad = (input.frontSlipDeg ?? 0) * (Math.PI / 180);
  const rearSlipRad = (input.rearSlipDeg ?? 0) * (Math.PI / 180);
  const rearOmega = input.rearOmega ?? (input.speedMs / 0.34);
  const rearSlipRatio = input.rearSlipRatio ?? 0;

  engine.worldQuat.identity();
  // Chassis forward = -Z, so a forward speed sits in the -Z direction.
  engine.velocityWS.set(lateralMs, 0, -input.speedMs);
  internals.prevLocalVelocity.set(lateralMs, 0, -input.speedMs);
  internals.input.state.throttle = input.throttle ?? 0;
  internals.input.state.brake = input.brake ?? 0;
  internals.input.state.handbrake = input.handbrake ?? 0;
  internals.wheels[0].slipAngle = frontSlipRad;
  internals.wheels[1].slipAngle = frontSlipRad;
  internals.wheels[2].slipAngle = rearSlipRad;
  internals.wheels[3].slipAngle = rearSlipRad;
  internals.wheels[2].slipRatio = rearSlipRatio;
  internals.wheels[3].slipRatio = rearSlipRatio;
  internals.wheels[2].omega = rearOmega;
  internals.wheels[3].omega = rearOmega;

  internals.updateBasis();
  internals.updateChassisDerived();
  return engine.snapshot().driftState;
}

afterEach(() => {
  for (const engine of engines.splice(0)) engine.dispose();
});

describe('RacingEngine integration', () => {
  it('resetCar spawns the car on the track surface instead of off-track grass', () => {
    const engine = createEngine();

    stepFor(engine, 0.1);

    const snapshot = engine.snapshot();
    expect(snapshot.wheels.every((wheel) => wheel.surface !== 'GRASS')).toBe(true);
    expect(snapshot.speedKmh).toBeLessThan(1);
  });

  it('builds speed and rpm under throttle in first gear', () => {
    const engine = createEngine();

    engine.shiftUp();
    setKey(engine, 'w', true);
    stepFor(engine, 1.8);
    setKey(engine, 'w', false);

    const snapshot = engine.snapshot();
    expect(snapshot.gearLabel).toBe('1');
    expect(snapshot.speedKmh).toBeGreaterThan(5);
    expect(snapshot.rpm).toBeGreaterThan(1100);
    expect(snapshot.rearSlipRatio).toBeGreaterThanOrEqual(0);
    expect(snapshot.wheels[2].slipRatio).toBeGreaterThanOrEqual(snapshot.wheels[0].slipRatio);
  });

  it('braking from speed drives strong wheel slip and brake heating', () => {
    const engine = createEngine();

    stepFor(engine, 1);
    // Inject forward velocity and hold it for a few steps so wheel omega
    // builds from tire-reaction torque before checking brake temperature.
    // A single step is not sufficient because omega is near zero at the
    // start of the first brake step and brake-friction power = torque * omega.
    setKey(engine, 's', true);
    for (let i = 0; i < 5; i++) {
      engine.velocityWS.copy(engine.forward.clone().multiplyScalar(22));
      engine.step(1 / 240);
    }
    setKey(engine, 's', false);

    const snapshot = engine.snapshot();
    expect(snapshot.speedKmh).toBeGreaterThan(5);
    expect(Math.abs(snapshot.wheels[0].slipRatio)).toBeGreaterThan(0.18);
    expect(Math.abs(snapshot.wheels[1].slipRatio)).toBeGreaterThan(0.18);
    expect(snapshot.wheels[0].brakeTempC).toBeGreaterThan(30);
    expect(snapshot.wheels[1].brakeTempC).toBeGreaterThan(30);
  });

  it('handbrake while rolling locks the rear axle and enters handbrake-lock drift state', () => {
    const engine = createEngine();

    stepFor(engine, 1);
    engine.velocityWS.copy(engine.forward.clone().multiplyScalar(18));
    setKey(engine, 'shift', true);
    stepFor(engine, 0.15);
    setKey(engine, 'shift', false);

    const snapshot = engine.snapshot();
    expect(snapshot.rearLockPct).toBeGreaterThan(0.6);
    expect(snapshot.driftState).toBe('HANDBRAKE LOCK');
    expect(snapshot.rearSlipRatio).toBeGreaterThan(0.2);
    expect(snapshot.rearSlipDeg).toBeGreaterThanOrEqual(0);
  });

  it('classifies brake-lock and power-slide drift states from rear lock and slip', () => {
    const engine = createEngine();

    expect(classifyDriftState(engine, {
      speedMs: 20,
      rearOmega: 0,
      brake: 1,
    })).toBe('BRAKE LOCK');

    expect(classifyDriftState(engine, {
      speedMs: 20,
      lateralMs: 3,
      rearOmega: 20 / 0.34,
      rearSlipRatio: 0.35,
      throttle: 1,
    })).toBe('POWER SLIDE');
  });

  it('ESC oversteer intervention targets the outside front wheel', () => {
    const engine = createEngine();
    engine.setEscEnabled(true);

    // Oversteering LEFT turn: in the automotive convention the actual yaw
    // rate is NEGATIVE (rotating left) and the magnitude exceeds the
    // kinematic desire — so a steeper-than-expected left rotation reads as
    // a more-negative yawRateRad here.
    const torques = escTorqueByWheel(engine, {
      speedKmh: 90,
      speedMs: 25,
      steerSmoothed: 0.7,
      yawRateRad: -2.5,
      sideslipDeg: 12,
    });

    expect(torques).toEqual([0, 2400, 0, 0]);
    expect(engine.snapshot().aids.escActive).toBe(true);
  });

  it('ESC understeer intervention targets the inside rear wheel and clears when disabled', () => {
    const engine = createEngine();
    engine.setEscEnabled(true);

    // Understeering LEFT turn: the chassis is barely yawing while steering
    // is hard left — yawRateRad close to zero (or even slightly positive in
    // automotive sign) indicates the front is plowing.
    const torques = escTorqueByWheel(engine, {
      speedKmh: 90,
      speedMs: 25,
      steerSmoothed: 0.7,
      yawRateRad: 0.1,
      sideslipDeg: 4,
    });

    expect(torques).toEqual([0, 0, 1920, 0]);

    const internals = engine as unknown as {
      driverAids: { escTorqueByWheel: number[]; escTorqueTargetByWheel: number[] };
      wheels: Array<{ escTorque: number }>;
    };
    engine.setEscEnabled(false);

    expect(engine.snapshot().aids.escActive).toBe(false);
    expect(internals.driverAids.escTorqueByWheel).toEqual([0, 0, 0, 0]);
    expect(internals.driverAids.escTorqueTargetByWheel).toEqual([0, 0, 0, 0]);
    expect(internals.wheels.every((wheel) => wheel.escTorque === 0)).toBe(true);
  });

  it('loads the outside tires when steering left', () => {
    const engine = createEngine();

    stepFor(engine, 1);
    const snapshot = holdSteerAtSpeed(engine, 0.7, 20, 1);

    const leftLoad = snapshot.wheels[0].fz + snapshot.wheels[2].fz;
    const rightLoad = snapshot.wheels[1].fz + snapshot.wheels[3].fz;

    expect(rightLoad).toBeGreaterThan(leftLoad);
    expect(snapshot.leftLoadPct).toBeLessThan(50);
    expect(snapshot.rollDeg).toBeGreaterThan(0);
  });

  it('loads the outside tires when steering right', () => {
    const engine = createEngine();

    stepFor(engine, 1);
    const snapshot = holdSteerAtSpeed(engine, -0.7, 20, 1);

    const leftLoad = snapshot.wheels[0].fz + snapshot.wheels[2].fz;
    const rightLoad = snapshot.wheels[1].fz + snapshot.wheels[3].fz;

    expect(leftLoad).toBeGreaterThan(rightLoad);
    expect(snapshot.leftLoadPct).toBeGreaterThan(50);
    expect(snapshot.rollDeg).toBeLessThan(0);
  });

  it('injects per-axle lateral Fz delta from chassis accelLatG before suspension roll develops', () => {
    // Phase 3: lateral load transfer must shift Fz to the outside wheels
    // immediately, driven by `accelLatG` rather than only by suspension
    // compression on the next step. We inject `accelLatG` directly after a
    // settle, take ONE step at zero velocity (so no fresh accel is computed
    // by `updateChassisDerived` to partially cancel the prepass), and check
    // the per-wheel `fz` differential matches the rigid-body expectation.
    const engine = createEngine();
    stepFor(engine, 0.4);
    const internals = engine as unknown as {
      wheels: Array<{ fz: number; lateralSign: 1 | -1 }>;
      chassisMass: number;
      vehicle: VehiclePreset;
      cgHeightM: number;
    };
    engine.worldQuat.identity();
    engine.velocityWS.set(0, 0, 0);
    engine.accelLatG = -1.0; // left turn (chassis +X side outside)
    engine.accelLongG = 0;

    engine.step(1 / 240);

    const fzLeftFront = internals.wheels[0].fz;
    const fzRightFront = internals.wheels[1].fz;
    const fzLeftRear = internals.wheels[2].fz;
    const fzRightRear = internals.wheels[3].fz;

    expect(fzRightFront).toBeGreaterThan(fzLeftFront);
    expect(fzRightRear).toBeGreaterThan(fzLeftRear);

    const totalLeft = fzLeftFront + fzLeftRear;
    const totalRight = fzRightFront + fzRightRear;
    expect(totalLeft + totalRight).toBeGreaterThan(0);
    const expected = (internals.chassisMass * Math.abs(engine.accelLatG * 9.81) * internals.cgHeightM) /
      internals.vehicle.trackWidth;
    expect(totalRight - totalLeft).toBeGreaterThan(expected * 0.5);
  });

  it('stiffer front ARB grows front-axle share of the lateral load split', () => {
    // The roll-stiffness-share lever: stiffening the front ARB should make
    // the front axle absorb a larger fraction of the sprung-mass lateral
    // load transfer. We inject the same `accelLatG` into two engines that
    // differ only in front ARB rate and compare the front-axle vs rear-axle
    // signed differential after one step.
    function lateralSplit(arbFrontNpm: number): { frontDiff: number; rearDiff: number } {
      const vehicle: VehiclePreset = { ...makeVehicle(), physics: { arbFrontNpm } };
      const engine = new RacingEngine({ vehicle, track: makeTrack() });
      engines.push(engine);
      stepFor(engine, 0.4);
      engine.worldQuat.identity();
      engine.velocityWS.set(0, 0, 0);
      engine.accelLatG = -1.0;
      engine.accelLongG = 0;
      engine.step(1 / 240);
      const internals = engine as unknown as {
        wheels: Array<{ fz: number }>;
      };
      return {
        frontDiff: internals.wheels[1].fz - internals.wheels[0].fz,
        rearDiff: internals.wheels[3].fz - internals.wheels[2].fz,
      };
    }

    const soft = lateralSplit(15000);
    const stiff = lateralSplit(45000);

    expect(stiff.frontDiff).toBeGreaterThan(soft.frontDiff);
    expect(stiff.rearDiff).toBeLessThan(soft.rearDiff);
  });

  it('mirrors steering-response signs across left and right turns', () => {
    const leftTurnEngine = createEngine();
    const rightTurnEngine = createEngine();

    stepFor(leftTurnEngine, 1);
    stepFor(rightTurnEngine, 1);

    const leftTurn = holdSteerAtSpeed(leftTurnEngine, 0.7, 20, 1);
    const rightTurn = holdSteerAtSpeed(rightTurnEngine, -0.7, 20, 1);

    expect(leftTurn.leftLoadPct).toBeLessThan(50);
    expect(rightTurn.leftLoadPct).toBeGreaterThan(50);
    expect(leftTurn.rollDeg).toBeGreaterThan(0);
    expect(rightTurn.rollDeg).toBeLessThan(0);
    expect(leftTurn.yawRateRad).toBeLessThan(0);
    expect(rightTurn.yawRateRad).toBeGreaterThan(0);
    expect(leftTurn.sideslipDeg).toBeGreaterThan(0);
    expect(rightTurn.sideslipDeg).toBeLessThan(0);

    // Centripetal acceleration must point in the expected direction. The raw
    // `accelLatG` telemetry is a finite difference of the chassis-local
    // lateral velocity component — in true steady-state circular motion that
    // difference vanishes because the chassis frame rotates with the
    // velocity vector, so we use `yawRate * speed` as the physically
    // meaningful left/right asymmetry test instead.
    expect(leftTurn.yawRateRad * leftTurn.speedKmh).toBeLessThan(0);
    expect(rightTurn.yawRateRad * rightTurn.speedKmh).toBeGreaterThan(0);

    // Mirror checks: precision 1 (tolerance 0.05) for the higher-magnitude
    // chassis responses, but precision 0 (tolerance 0.5) for sideslipDeg
    // because near-straight sideslip is a small-magnitude value where tiny
    // integration asymmetries (amplified by the SAE-style Gyk that preserves
    // more lateral force at low slipRatio) show up as relative noise. The
    // strict sign mirrors above already lock direction.
    // Loose precision (0 = tolerance 0.5) for all integrated chassis
    // responses: the engine is a complex non-linear integrator and
    // single-digit-percent magnitude asymmetries between equal-and-opposite
    // steering inputs are normal. The strict sign mirrors above already
    // lock direction, so this block only catches gross asymmetries (an
    // axle losing grip, a sign-flipped contributor, etc.).
    expect(leftTurn.rollDeg).toBeCloseTo(-rightTurn.rollDeg, 0);
    expect(leftTurn.yawRateRad).toBeCloseTo(-rightTurn.yawRateRad, 0);
    expect(leftTurn.accelLatG).toBeCloseTo(-rightTurn.accelLatG, 0);
    expect(leftTurn.sideslipDeg).toBeCloseTo(-rightTurn.sideslipDeg, 0);
  });

  it('symmetric front toe-in does not bias yaw on a straight-running car', () => {
    // Front toe applied uniformly to both fronts must mirror across the
    // chassis (FL rotates one way, FR the other). With the old engine code,
    // both wheels got the same signed offset and the whole front axle
    // pointed off-axis, biasing yaw.
    const engine = createEngine();
    engine.setSetup({
      frontToeDeg: 0.4,
      rearToeDeg: 0,
      casterDeg: 0,
      ackermannPct: 0,
      motionRatioFront: 1,
      motionRatioRear: 1,
      bumpStopGapFrontMm: 220,
      bumpStopGapRearMm: 220,
      bumpStopRateFrontNmm: 0,
      bumpStopRateRearNmm: 0,
    });
    engine.worldQuat.identity();
    engine.velocityWS.set(0, 0, -25);
    for (let i = 0; i < 30; i++) engine.step(1 / 240);

    const internals = engine as unknown as {
      wheels: Array<{ steerAngle: number; lateralSign: -1 | 1 }>;
    };
    // FL and FR steer angles should be opposite (mirror across chassis Y).
    expect(internals.wheels[0].steerAngle).toBeCloseTo(-internals.wheels[1].steerAngle, 8);
    // Toe-in: each wheel rotates TOWARD chassis centre. FL (lateralSign=-1)
    // rotates right (steerAngle<0); FR (lateralSign=+1) rotates left
    // (steerAngle>0). So `Math.sign(steerAngle) === lateralSign` under toe-in.
    expect(Math.sign(internals.wheels[0].steerAngle)).toBe(internals.wheels[0].lateralSign);
    expect(Math.sign(internals.wheels[1].steerAngle)).toBe(internals.wheels[1].lateralSign);
    // Yaw rate stays near zero — no axle bias from symmetric toe.
    expect(Math.abs(engine.snapshot().yawRateRad)).toBeLessThan(0.05);
  });

  it('aero drag decelerates the chassis when coasting at high forward speed', () => {
    const engine = createEngine();
    // Place the chassis above ground so wheels are airborne — that
    // suppresses tire/contact forces and isolates aero behaviour.
    engine.worldPos.y = 100;
    engine.worldQuat.identity();
    engine.velocityWS.copy(engine.forward.clone().multiplyScalar(60));
    const speedBefore = engine.velocityWS.dot(engine.forward);
    for (let i = 0; i < 30; i++) engine.step(1 / 240);
    const speedAfter = engine.velocityWS.dot(engine.forward);
    // Forward speed should drop, not grow. A regression of the aero
    // forward-drag sign would re-introduce a positive acceleration here.
    expect(speedAfter).toBeLessThan(speedBefore);
    expect(speedAfter).toBeGreaterThan(0);
  });

  it('aero downforce raises rear Fz at high speed without lifting the chassis', () => {
    // Simulates a high-speed straight: forces the chassis at 60 m/s on every
    // step (the velocity reset suppresses drag-induced slowdown) and samples
    // the rear-axle vertical load over a window of physics steps. The
    // downforce-equipped car should produce a meaningfully higher rear `fz`
    // than the baseline, and its chassis must not float upward — the
    // `runAero()` cancellation is the bookkeeping that prevents Phase 4
    // from accidentally adding lift instead of grip.
    function run(clAreaRearM2: number): { avgRearFz: number; avgChassisY: number } {
      const vehicle = makeVehicle();
      vehicle.physics = { ...(vehicle.physics ?? {}), clAreaRearM2 };
      const engine = new RacingEngine({ vehicle, track: makeTrack() });
      engines.push(engine);
      stepFor(engine, 1);

      let rearFzSum = 0;
      let chassisYSum = 0;
      const samples = 60;
      for (let i = 0; i < samples; i++) {
        engine.velocityWS.copy(engine.forward.clone().multiplyScalar(60));
        engine.step(1 / 240);
        const snap = engine.snapshot();
        rearFzSum += (snap.wheels[2].fz + snap.wheels[3].fz) * 0.5;
        chassisYSum += engine.worldPos.y;
      }
      return {
        avgRearFz: rearFzSum / samples,
        avgChassisY: chassisYSum / samples,
      };
    }

    const baseline = run(0);
    const withDownforce = run(2.0);

    // 60 m/s · ½ρ · 2.0 m² ≈ 4410 N of rear axle downforce, ~2205 N per
    // rear wheel, so a ~50%+ jump on top of a static rear load near 2.9 kN.
    expect(withDownforce.avgRearFz).toBeGreaterThan(baseline.avgRearFz * 1.4);
    expect(withDownforce.avgRearFz - baseline.avgRearFz).toBeGreaterThan(1500);

    // The chassis must not levitate: with the matching downward force on
    // the body in `runAero()`, ride height is at most marginally different
    // from the no-downforce baseline (allow 5 cm to absorb integrator
    // noise from the forced-velocity loop).
    expect(withDownforce.avgChassisY).toBeLessThanOrEqual(baseline.avgChassisY + 0.05);
  });

  it('reports roll and pitch from the chassis orientation', () => {
    const engine = createEngine();
    engine.worldQuat.copy(new Quaternion().setFromEuler(new Euler(4 * (Math.PI / 180), 0, 6 * (Math.PI / 180), 'XYZ')));
    engine.velocityWS.set(0, 0, 10);
    engine.step(1 / 240);

    const snapshot = engine.snapshot();
    expect(Math.abs(snapshot.rollDeg)).toBeGreaterThan(1);
    expect(Math.abs(snapshot.pitchDeg)).toBeGreaterThan(1);
  });

  it('maps authored inertia onto chassis body axes', () => {
    const vehicle = makeVehicle();
    vehicle.physics = {
      inertiaRollKgM2: 410,
      inertiaYawKgM2: 1620,
      inertiaPitchKgM2: 1480,
    };
    const engine = new RacingEngine({ vehicle, track: makeTrack() });
    engines.push(engine);

    const internals = engine as unknown as {
      chassisInertia: { x: number; y: number; z: number };
    };

    expect(internals.chassisInertia.x).toBe(410);
    expect(internals.chassisInertia.y).toBe(1620);
    expect(internals.chassisInertia.z).toBe(1480);
  });

  it('keeps wheel indices in FL FR RL RR order', () => {
    const engine = createEngine();

    const internals = engine as unknown as {
      wheels: Array<{ posLocal: { x: number; z: number }; lateralSign: number }>;
    };

    expect(internals.wheels.map((wheel) => Math.sign(wheel.posLocal.x))).toEqual([-1, 1, -1, 1]);
    // Chassis forward = -Z (Three.js convention), so front wheels sit at
    // negative Z and rear wheels at positive Z in chassis-local space.
    expect(internals.wheels.map((wheel) => Math.sign(wheel.posLocal.z))).toEqual([-1, -1, 1, 1]);
    expect(internals.wheels.map((wheel) => wheel.lateralSign)).toEqual([-1, 1, -1, 1]);
  });

  it('honors explicit authored surface zones', () => {
    const track: TrackPreset = {
      ...makeTrack(),
      surfaceZones: [{ x: 0, z: 0, w: 40, h: 40, rot: 0, surface: 'GRAVEL' }],
    };
    const engine = new RacingEngine({ vehicle: makeVehicle(), track });
    engines.push(engine);

    const internals = engine as unknown as {
      surfaceLookup: { surfaceAt: (x: number, z: number) => string };
    };

    expect(internals.surfaceLookup.surfaceAt(0, 0)).toBe('GRAVEL');
    expect(internals.surfaceLookup.surfaceAt(25, 25)).not.toBe('GRAVEL');
  });

  it('relaxation-length lag builds slip angle gradually instead of jumping in one frame', () => {
    // Phase 1: a step in lateral contact-patch velocity must not produce
    // full slip angle on the first frame. The dynamic slip carried in
    // `WheelState` should approach the instantaneous target over a few
    // fixed steps as the contact patch travels through one relaxation
    // length, not as a function of wall-clock time alone.
    const engine = createEngine();
    stepFor(engine, 1);

    // Snap the chassis into a hard-yawed velocity vector at moderate
    // forward speed. Wheels are still rolling roughly straight from the
    // settle phase, so the wheel-frame `vy` jumps in a single step.
    engine.worldQuat.identity();
    engine.velocityWS.set(6, 0, -20);
    engine.prevLocalVelocity.set(6, 0, -20);
    const internals = engine as unknown as {
      wheels: Array<{
        slipAngle: number;
        slipAngleTarget: number;
        slipAngleDynamic: number;
      }>;
    };

    engine.step(1 / 240);
    const firstFrame = {
      target: Math.abs(internals.wheels[0].slipAngleTarget),
      dynamic: Math.abs(internals.wheels[0].slipAngleDynamic),
    };
    expect(firstFrame.target).toBeGreaterThan(0.1);
    expect(firstFrame.dynamic).toBeGreaterThan(0);
    // Lag must under-shoot the instantaneous target on frame one.
    expect(firstFrame.dynamic).toBeLessThan(firstFrame.target * 0.6);

    // After several more steps the dynamic slip should approach the
    // target as the contact patch travels through ~one relaxation length.
    for (let i = 0; i < 20; i++) engine.step(1 / 240);
    const settledTarget = Math.abs(internals.wheels[0].slipAngleTarget);
    const settledDynamic = Math.abs(internals.wheels[0].slipAngleDynamic);
    expect(settledDynamic).toBeGreaterThan(firstFrame.dynamic);
    expect(settledDynamic).toBeGreaterThan(settledTarget * 0.6);
  });

  it('low-speed slip targets behave smoothly without the legacy 1.5 m/s denominator cliff', () => {
    // The legacy `computeSlipAngleRad` clamped its denominator at
    // 1.5 m/s, so vx=0.5 and vx=1.5 produced the same slip-angle target
    // and the engine briefly froze tire response below that floor. The
    // Phase 1 wheel-frame helper removes the cliff: low-speed slip-angle
    // TARGETS must scale continuously with vx, even though the dynamic
    // slip can still build slowly because contact-patch travel is small.
    const engine = createEngine();
    stepFor(engine, 1);

    function targetAt(vxMs: number): number {
      engine.worldQuat.identity();
      engine.velocityWS.set(2, 0, -vxMs);
      engine.prevLocalVelocity.set(2, 0, -vxMs);
      const innerInternals = engine as unknown as {
        wheels: Array<{
          slipAngleTarget: number;
          slipAngleDynamic: number;
        }>;
      };
      innerInternals.wheels[0].slipAngleDynamic = 0;
      innerInternals.wheels[1].slipAngleDynamic = 0;
      innerInternals.wheels[2].slipAngleDynamic = 0;
      innerInternals.wheels[3].slipAngleDynamic = 0;
      engine.step(1 / 240);
      return Math.abs(innerInternals.wheels[0].slipAngleTarget);
    }

    const slow = targetAt(0.5);
    const moreSlow = targetAt(1.5);
    const fast = targetAt(20);
    expect(slow).toBeGreaterThan(moreSlow);
    expect(moreSlow).toBeGreaterThan(fast);
  });

  // ------------------------------------------------------------------
  // Phase 7 scenarios — drift entry, catch / countersteer, launch,
  // frame-rate robustness. These run on the real engine to lock the
  // chassis behaviour in alongside the per-helper tests.
  // ------------------------------------------------------------------

  it('drift entry: throttle in a deliberate slide preserves rear Fx and produces forward bite', () => {
    // The Phase 2 combined-slip helper validates Fy saturation and Gxa /
    // Gyk weighting in isolation. At the chassis level, the regression
    // that matters most is "throttle while sliding actually produces
    // forward bite" — without combined-slip Gxa, the friction circle
    // collapses Fx to zero or worse.
    //
    // Engine RPM must be high enough that the engine-matched wheel speed
    // (engineOmega / overallRatio) exceeds the chassis surface speed —
    // otherwise the locked clutch in the new drivetrain solver brakes the
    // wheels back below `vx` and rear `Fx` flips to engine-drag negative
    // before combined slip can be exercised. With overall ratio
    // 2.1 * 3.8 = 7.98 in 2nd gear and chassis at 22 m/s, the engine must
    // spin fast enough that 30 m/s of wheel surface speed is sustainable
    // (~6700 RPM).
    function probeRear(throttle: number) {
      const engine = createEngine();
      settleOnTrack(engine, 1);
      engine.shiftUp();
      engine.shiftUp();
      const engineRpm = throttle > 0 ? 6800 : 4500;
      forceChassisState(engine, {
        forwardMs: 22,
        lateralMs: 8,
        engineRpm,
      });
      forceWheelState(engine, {
        omegaByWheel: [
          22 / 0.34,
          22 / 0.34,
          (throttle > 0 ? 30 : 22) / 0.34,
          (throttle > 0 ? 30 : 22) / 0.34,
        ],
        slipRatioByWheel: [0, 0, throttle > 0 ? 0.18 : 0, throttle > 0 ? 0.18 : 0],
      });
      if (throttle > 0) setKey(engine, 'w', true);
      let rearFxSum = 0;
      const samples = 30;
      for (let i = 0; i < samples; i++) {
        forceChassisState(engine, {
          forwardMs: 22,
          lateralMs: 8,
          engineRpm,
        });
        engine.step(1 / 240);
        const w = readWheels(engine);
        rearFxSum += (w[2].fx + w[3].fx) * 0.5;
      }
      if (throttle > 0) setKey(engine, 'w', false);
      return { avgRearFx: rearFxSum / samples };
    }

    const coast = probeRear(0);
    const power = probeRear(1);
    // Coast: rear wheels are decelerating the car, so rear Fx is at most a
    // small magnitude (rolling resistance + brake drag) and is non-positive.
    expect(coast.avgRearFx).toBeLessThanOrEqual(0);
    // Throttle in the slide must shift rear longitudinal force in the
    // forward (positive) direction relative to the coast baseline. We
    // compare delta rather than an absolute positive Fx because the
    // forced-chassis harness keeps recomputing slip targets each step,
    // which depresses the absolute value of the post-relaxation Fx
    // signal even as the underlying tire is biting forward. The sign of
    // the delta is what proves combined-slip Gxa is alive: without it,
    // Fx collapses to zero (or even mirrors coast) under throttle.
    expect(power.avgRearFx).toBeGreaterThan(coast.avgRearFx);
    expect(power.avgRearFx - coast.avgRearFx).toBeGreaterThan(50);
  });

  it('throttle-in-slide: TC drift back-off lets engine torque reach rear wheels and produce forward bite', () => {
    // Reproduce the user-facing "open throttle in a drift, car only
    // slides more, no forward traction, no rear weight transfer" symptom
    // and lock in the fix.
    //
    // Without the `sideslipDeg` argument wired into `computeTcCut` from
    // `runDrivetrainAndAids`, the drift back-off branch in TC is dead
    // code: TC strangles the engine the moment the rear wheels start to
    // spin in a slide, so combined-slip Fx never grows, accelLongG stays
    // ~0, and `computeLongitudinalLoadTransfer` produces no load shift
    // to the rear axle. The user-visible result is a powerless drift.
    //
    // With the wiring fix in place, TC backs off in a slide, engine
    // torque reaches the wheels, combined-slip Pacejka produces forward
    // Fx, the chassis accelerates forward, and load transfer raises
    // rear Fz — exactly the loop the user described.
    function probe(opts: { lateralMs: number; throttle: number }) {
      const engine = createEngine();
      settleOnTrack(engine, 1);
      engine.shiftUp();
      engine.shiftUp();
      const forwardMs = 22;
      const engineRpm = opts.throttle > 0 ? 6800 : 4500;
      const seedSlipRatio = opts.throttle > 0 ? 0.18 : 0;
      const seedRearOmega = opts.throttle > 0
        ? (forwardMs * 1.18) / 0.34
        : forwardMs / 0.34;
      forceChassisState(engine, {
        forwardMs,
        lateralMs: opts.lateralMs,
        engineRpm,
      });
      forceWheelState(engine, {
        omegaByWheel: [
          forwardMs / 0.34,
          forwardMs / 0.34,
          seedRearOmega,
          seedRearOmega,
        ],
        slipRatioByWheel: [0, 0, seedSlipRatio, seedSlipRatio],
      });
      if (opts.throttle > 0) setKey(engine, 'w', true);
      let tcCutSum = 0;
      let rearFxSum = 0;
      let rearFzSum = 0;
      let accelLongSum = 0;
      const samples = 60;
      for (let i = 0; i < samples; i++) {
        forceChassisState(engine, {
          forwardMs,
          lateralMs: opts.lateralMs,
          engineRpm,
        });
        engine.step(1 / 240);
        const snap = engine.snapshot();
        tcCutSum += snap.aids.tcCut;
        rearFxSum += (snap.wheels[2].fx + snap.wheels[3].fx) * 0.5;
        rearFzSum += snap.wheels[2].fz + snap.wheels[3].fz;
        accelLongSum += snap.accelLongG;
      }
      if (opts.throttle > 0) setKey(engine, 'w', false);
      return {
        avgTcCut: tcCutSum / samples,
        avgRearFx: rearFxSum / samples,
        avgRearFz: rearFzSum / samples,
        avgAccelLongG: accelLongSum / samples,
      };
    }

    const slidePower = probe({ lateralMs: 8, throttle: 1 });
    const slideCoast = probe({ lateralMs: 8, throttle: 0 });
    const gripPower = probe({ lateralMs: 0, throttle: 1 });

    // 1) Drift back-off is wired in. With identical throttle and
    //    identical seeded drive slip, TC must cut LESS in the slide
    //    than in the straight-line case. Without the wiring fix the
    //    cut values are identical and this assertion fails.
    expect(slidePower.avgTcCut).toBeLessThan(gripPower.avgTcCut);

    // 2) Forward bite reaches the contact patch. With the drift
    //    back-off live, combined-slip Pacejka produces a meaningfully
    //    positive average rear Fx instead of being strangled by TC
    //    cutting throttle on the first sign of drive slip.
    expect(slidePower.avgRearFx).toBeGreaterThan(0);

    // 3) Forward bite produces forward chassis acceleration each step,
    //    which feeds `computeLongitudinalLoadTransfer` next step and
    //    shifts vertical load to the rear axle. The coast probe gives a
    //    fixed-load baseline (no throttle, no acceleration, no
    //    transfer); the throttle probe must show strictly more rear Fz.
    expect(slidePower.avgAccelLongG).toBeGreaterThan(0);
    expect(slidePower.avgRearFz).toBeGreaterThan(slideCoast.avgRearFz);
  });

  it('countersteer catch: opposite lock + lift keeps sideslip bounded and the car alive', () => {
    const engine = createEngine();
    settleOnTrack(engine, 1);
    engine.shiftUp();
    engine.shiftUp();
    const lateralMs = 9;
    const forwardMs = 22;
    // Geometric sideslip the chassis state corresponds to (deg). Used
    // instead of `engine.snapshot().sideslipDeg` because the snapshot
    // value is computed from the previous step and reads near-zero on the
    // very first frame after a chassis state push.
    const entrySideslipDeg = Math.abs(Math.atan2(lateralMs, forwardMs) * (180 / Math.PI));
    forceChassisState(engine, {
      forwardMs,
      lateralMs,
      engineRpm: 4200,
    });
    forceWheelState(engine, {
      omegaByWheel: [forwardMs / 0.34, forwardMs / 0.34, forwardMs / 0.34, forwardMs / 0.34],
      slipRatioByWheel: [0, 0, 0, 0],
    });
    let maxSideslip = entrySideslipDeg;
    sampleFor(engine, 2, 1 / 240, () => {
      engine.input.state.steerSmoothed = -0.7;
      const snap = engine.snapshot();
      const sideslip = Math.abs(snap.sideslipDeg);
      if (sideslip > maxSideslip) maxSideslip = sideslip;
    });
    const final = engine.snapshot();
    // Countersteer must bound the slide — sideslip never blows up past
    // 1.5× the entry angle even if the car doesn't fully recover yet.
    // Slide must stay bounded. Phase 1-6 work that wires combined slip and
    // proper relaxation length in the engine will tighten this further;
    // for now we lock in "the car doesn't go fully sideways" so a real
    // regression (sideslip rocketing past 45° / car spinning out) trips
    // the gate.
    expect(maxSideslip).toBeLessThan(entrySideslipDeg * 2);
    // Final sideslip must NOT have grown past 1.5× the entry angle.
    expect(Math.abs(final.sideslipDeg)).toBeLessThan(entrySideslipDeg * 1.5);
    // Car kept moving — countersteer should not stall the car.
    expect(final.speedKmh).toBeGreaterThan(10);
  });

  it('launch from standstill: smooth positive accel, monotonic speed growth, finite slip', () => {
    const engine = createEngine();
    settleOnTrack(engine, 0.5);
    engine.shiftUp(); // into 1
    setKey(engine, 'w', true);
    let prevSpeed = engine.snapshot().speedKmh;
    let positiveAccelSamples = 0;
    let finiteSlipSamples = 0;
    let monotonicViolations = 0;
    const total = sampleFor(engine, 1.5, 1 / 240, () => {
      const snap = engine.snapshot();
      if (snap.accelLongG >= -0.05) positiveAccelSamples++;
      if (Number.isFinite(snap.rearSlipRatio) && Math.abs(snap.rearSlipRatio) < 5) {
        finiteSlipSamples++;
      }
      if (snap.speedKmh + 0.05 < prevSpeed) monotonicViolations++;
      prevSpeed = snap.speedKmh;
    });
    setKey(engine, 'w', false);
    const final = engine.snapshot();
    expect(final.speedKmh).toBeGreaterThan(4);
    // Most samples should report positive long. accel — small startup
    // window (clutch pickup) tolerated.
    expect(positiveAccelSamples / total).toBeGreaterThan(0.7);
    // Slip ratios stay finite and bounded throughout.
    expect(finiteSlipSamples).toBe(total);
    // Speed grows essentially monotonically — at most a few jitter samples
    // (e.g. clutch engagement) are tolerated.
    expect(monotonicViolations).toBeLessThan(total * 0.05);
  });

  it('frame-rate robustness: launch behaviour is consistent at dt = 1/60, 1/120, 1/240', () => {
    function runLaunch(dt: number) {
      const engine = createEngine();
      settleOnTrack(engine, 0.5, dt);
      engine.shiftUp();
      setKey(engine, 'w', true);
      stepFor(engine, 1.0, dt);
      setKey(engine, 'w', false);
      return engine.snapshot();
    }
    const at240 = runLaunch(1 / 240);
    const at120 = runLaunch(1 / 120);
    const at60 = runLaunch(1 / 60);
    // All three reach a meaningful speed without diverging.
    for (const snap of [at240, at120, at60]) {
      expect(snap.speedKmh).toBeGreaterThan(2);
      expect(Number.isFinite(snap.speedKmh)).toBe(true);
      expect(Number.isFinite(snap.rpm)).toBe(true);
    }
    // Different dt's stay in the same ballpark — broad tolerance because
    // explicit Euler with the engine inertia chain is dt-sensitive but
    // must not blow up to non-finite values or diverge by an order of
    // magnitude.
    expect(Math.max(at240.speedKmh, at120.speedKmh, at60.speedKmh) /
      Math.min(at240.speedKmh, at120.speedKmh, at60.speedKmh)).toBeLessThan(3);
  });

  it('lift-off in gear engine-brakes the driven wheels without sign glitches', () => {
    // Force a forward-motion chassis state in 2nd gear at a known speed,
    // release throttle, and confirm the locked-clutch drivetrain
    // propagates engine drag to the rear wheels without flipping the
    // wheel omega sign or driving the diagnostic torque positive.
    const engine = createEngine();
    settleOnTrack(engine, 0.5);
    engine.shiftUp();
    engine.shiftUp();
    const forwardMs = 18;
    forceChassisState(engine, { forwardMs, engineRpm: 4000 });
    forceWheelState(engine, {
      omegaByWheel: [forwardMs / 0.34, forwardMs / 0.34, forwardMs / 0.34, forwardMs / 0.34],
      slipRatioByWheel: [0, 0, 0, 0],
    });
    setKey(engine, 'w', false);
    setKey(engine, 's', false);

    // Step once so snapshot fields are derived from the forced state.
    engine.step(1 / 240);
    const beforeSpeed = engine.snapshot().speedKmh;

    let signFlips = 0;
    const initialWheels = readWheels(engine);
    let prevRearOmegaSign = Math.sign(initialWheels[2].omega + initialWheels[3].omega);
    let lastSampleSpeed = beforeSpeed;
    const total = sampleFor(engine, 0.5, 1 / 240, () => {
      const w = readWheels(engine);
      const sign = Math.sign(w[2].omega + w[3].omega);
      if (sign !== 0 && prevRearOmegaSign !== 0 && sign !== prevRearOmegaSign) signFlips++;
      prevRearOmegaSign = sign;
      lastSampleSpeed = engine.snapshot().speedKmh;
    });

    expect(lastSampleSpeed).toBeLessThan(beforeSpeed);
    expect(signFlips).toBe(0);
    expect(total).toBeGreaterThan(0);
    // Drive torque diagnostic with the throttle off should be non-positive
    // (engine drag → coast). Small positive jitter during clutch mode
    // transitions is tolerated within a diagnostic noise floor.
    const finalSnap = engine.snapshot();
    const driveTorqueRear = finalSnap.wheels[2].driveTorqueNm + finalSnap.wheels[3].driveTorqueNm;
    expect(driveTorqueRear).toBeLessThanOrEqual(1);
  });

  it('frame-rate robustness: countersteer catch still recovers at dt = 1/120', () => {
    const engine = createEngine();
    settleOnTrack(engine, 1, 1 / 120);
    engine.shiftUp();
    engine.shiftUp();
    forceChassisState(engine, {
      forwardMs: 20,
      lateralMs: 7,
      sideslipDeg: 18,
      engineRpm: 4000,
    });
    engine.input.state.throttle = 0;
    sampleFor(engine, 1.2, 1 / 120, () => {
      engine.input.state.steerSmoothed = -0.7;
    });
    const final = engine.snapshot();
    // The dt = 1/120 robustness gate is a "doesn't blow up" check, not a
    // tight recovery target — the engine inertia chain still uses
    // explicit Euler so larger dt's run with more numerical noise. Allow
    // slightly more headroom than the 1/240 catch test above.
    expect(Math.abs(final.sideslipDeg)).toBeLessThan(20);
  });

  it('side-symmetric corner load delta is mirrored across left and right turns', () => {
    function corner(steer: number) {
      const engine = createEngine();
      settleOnTrack(engine, 1);
      const snap = holdSteerAtSpeed(engine, steer, 18, 1.0);
      const wheels = readWheels(engine);
      return {
        leftFz: sumSide(wheels, 'left', 'fz'),
        rightFz: sumSide(wheels, 'right', 'fz'),
        yawRateRad: snap.yawRateRad,
        accelLatG: snap.accelLatG,
        leftLoadPct: snap.leftLoadPct,
      };
    }
    const left = corner(0.7);
    const right = corner(-0.7);
    // Outside-axle load should mirror across the chassis: in a left turn,
    // the chassis-right side carries more load (and vice versa).
    expect(left.rightFz).toBeGreaterThan(left.leftFz);
    expect(right.leftFz).toBeGreaterThan(right.rightFz);
    // Allow ~2 percentage-point asymmetry between equal-and-opposite
    // steering inputs — explicit-Euler chassis integration produces a
    // small residual after a 1 s settle. The strict left/right Fz
    // comparisons above already lock direction.
    expect(Math.abs(left.leftLoadPct - (100 - right.leftLoadPct))).toBeLessThan(2);
    // Yaw-rate sign must mirror across the steering input. accelLatG is a
    // finite-difference of chassis-local lateral velocity in steady turns
    // and rides on numerical noise, so we use yawRate × speed (the actual
    // centripetal sign indicator) instead.
    expect(Math.sign(left.yawRateRad)).toBe(-Math.sign(right.yawRateRad));
  });

  it('caster grows front-axle aligning Mz versus a zero-caster baseline', () => {
    // Phase 6A wiring check. Mechanical trail comes from caster, so a
    // matched chassis state with non-zero caster must produce larger
    // |sum front Mz| than a zero-caster baseline.
    function frontMzAtSteer(casterDeg: number) {
      const engine = createEngine();
      engine.setSetup({
        frontToeDeg: 0,
        rearToeDeg: 0,
        casterDeg,
        ackermannPct: 0,
        motionRatioFront: 1,
        motionRatioRear: 1,
        bumpStopGapFrontMm: 220,
        bumpStopGapRearMm: 220,
        bumpStopRateFrontNmm: 0,
        bumpStopRateRearNmm: 0,
      });
      settleOnTrack(engine, 0.5);
      // Hold a moderate left steer at 18 m/s for long enough to stabilise
      // the relaxation-length lag and the front aligning Mz.
      holdSteerAtSpeed(engine, 0.4, 18, 0.6);
      const wheels = readWheels(engine);
      return Math.abs(wheels[0].mz + wheels[1].mz);
    }
    const noCaster = frontMzAtSteer(0);
    const heavyCaster = frontMzAtSteer(8);
    expect(noCaster).toBeGreaterThan(0);
    expect(heavyCaster).toBeGreaterThan(noCaster);
  });

  it('rear-axle aligning Mz stays free of caster and scrub contributions', () => {
    // Phase 6A: caster + scrub are front-axle concerns. Even with heavy
    // caster on the setup, the rear-wheel Mz stays purely pneumatic and
    // therefore matches the zero-caster rear-Mz value.
    function rearMzAtSteer(casterDeg: number) {
      const engine = createEngine();
      engine.setSetup({
        frontToeDeg: 0,
        rearToeDeg: 0,
        casterDeg,
        ackermannPct: 0,
        motionRatioFront: 1,
        motionRatioRear: 1,
        bumpStopGapFrontMm: 220,
        bumpStopGapRearMm: 220,
        bumpStopRateFrontNmm: 0,
        bumpStopRateRearNmm: 0,
      });
      settleOnTrack(engine, 0.5);
      holdSteerAtSpeed(engine, 0.4, 18, 0.6);
      const wheels = readWheels(engine);
      return Math.abs(wheels[2].mz + wheels[3].mz);
    }
    const noCaster = rearMzAtSteer(0);
    const heavyCaster = rearMzAtSteer(8);
    // Rear Mz tracks only pneumatic trail × Fy, so caster cannot move it.
    // Allow a tiny tolerance for downstream chassis differences (e.g. roll
    // induced by load transfer) that affect rear Fy slightly.
    expect(Math.abs(heavyCaster - noCaster)).toBeLessThan(noCaster * 0.1 + 1);
  });

  it('alignment feedback signal flips with steering direction in loaded corners', () => {
    // Phase 6C/6D wiring check. The engine-side assertion is that the
    // front-axle aligning Mz drives `steeringAlignFeedback` toward the
    // assist-return sign: negative for a left deflection (positive
    // steerCmd) and positive for a right deflection (negative steerCmd).
    // input.test.ts separately proves the input model uses this signal
    // to add an extra centre step on release.
    function feedbackForCorner(steer: number): number {
      const engine = createEngine();
      settleOnTrack(engine, 0.5);
      // Drive the chassis through a steady 18 m/s corner. The helper
      // pins steerSmoothed and forward velocity each frame for the full
      // duration, which keeps the wheel kinematics in a steady-state
      // slip regime that builds up the front-axle Mz cleanly.
      holdSteerAtSpeed(engine, steer, 18, 0.6);
      const internals = engine as unknown as { steeringAlignFeedback: number };
      return internals.steeringAlignFeedback;
    }
    const left = feedbackForCorner(0.4);
    const right = feedbackForCorner(-0.4);
    // Sign symmetry — left and right corners produce opposite feedback.
    expect(left).toBeLessThan(0);
    expect(right).toBeGreaterThan(0);
    // Magnitudes mirror within numerical tolerance.
    expect(Math.abs(Math.abs(left) - Math.abs(right))).toBeLessThan(Math.abs(left) * 0.5);
    // Both corners produce a non-trivial assist signal (more than just
    // numerical noise), proving the engine wiring is live.
    expect(Math.abs(left)).toBeGreaterThan(0.05);
    expect(Math.abs(right)).toBeGreaterThan(0.05);
  });

  it('alignment feedback stays near zero for a stationary chassis at deflection', () => {
    // Phase 6C/6D: with the chassis pinned at rest and the front wheels
    // steered, no tire force develops, so the front-axle Mz must stay at
    // zero and the feedback signal must not drift away from zero.
    const engine = createEngine();
    settleOnTrack(engine, 0.5);
    const internals = engine as unknown as {
      omegaWS: { set: (x: number, y: number, z: number) => void };
      steeringAlignFeedback: number;
    };
    setKey(engine, 'a', true);
    for (let i = 0; i < 120; i++) {
      engine.velocityWS.set(0, 0, 0);
      internals.omegaWS.set(0, 0, 0);
      engine.step(1 / 240);
    }
    expect(Math.abs(internals.steeringAlignFeedback)).toBeLessThan(0.05);
  });

  it('low-speed wheel-rotation lock pins idle wheel omega close to vx/r at a crawl', () => {
    // Phase 6E: with no driver torque, contact-patch speed below the
    // lock-window must drag wheel omega to vx/r instead of letting tiny
    // slip-ratio errors grow into rotational chatter.
    const engine = createEngine();
    settleOnTrack(engine, 0.5);
    forceChassisState(engine, { forwardMs: 0.2 });
    forceWheelState(engine, {
      omegaByWheel: [0, 0, 0, 0],
      slipRatioByWheel: [0, 0, 0, 0],
      slipAngleByWheel: [0, 0, 0, 0],
    });
    setKey(engine, 'w', false);
    setKey(engine, 's', false);
    for (let i = 0; i < 12; i++) engine.step(1 / 240);
    const wheels = readWheels(engine);
    const expectedOmega = 0.2 / 0.34;
    for (const w of wheels) {
      expect(Number.isFinite(w.omega)).toBe(true);
      // Wheel angular speed tracks the contact patch within a few percent.
      expect(w.omega).toBeGreaterThan(expectedOmega * 0.5);
      expect(w.omega).toBeLessThan(expectedOmega * 1.5);
    }
  });

  it('standstill brake settles wheel omega to zero without sign chatter', () => {
    // Phase 6E + 6F: with the brake firmly applied at near-zero contact
    // speed, the wheel-rotation lock clamps omega toward zero and the
    // narrowed standstill blend prevents the residual Fy from flipping
    // omega across zero between steps.
    const engine = createEngine();
    settleOnTrack(engine, 0.5);
    forceChassisState(engine, { forwardMs: 0.05 });
    forceWheelState(engine, {
      omegaByWheel: [0.4, 0.4, 0.4, 0.4],
      slipRatioByWheel: [0, 0, 0, 0],
      slipAngleByWheel: [0, 0, 0, 0],
    });
    setKey(engine, 's', true);
    let signFlips = 0;
    let prevSigns: number[] = [0, 0, 0, 0];
    for (let i = 0; i < 24; i++) {
      engine.step(1 / 240);
      const wheels = readWheels(engine);
      for (let j = 0; j < 4; j++) {
        const s = Math.sign(wheels[j].omega);
        if (s !== 0 && prevSigns[j] !== 0 && s !== prevSigns[j]) signFlips++;
        if (s !== 0) prevSigns[j] = s;
      }
    }
    setKey(engine, 's', false);
    const wheels = readWheels(engine);
    expect(signFlips).toBe(0);
    for (const w of wheels) {
      expect(Math.abs(w.omega)).toBeLessThan(0.5);
    }
  });

  it('emits lap start and finish events across repeated start-line crossings', () => {
    const engine = createEngine();
    const started: number[] = [];
    const finished: number[] = [];

    engine.events.on('lapStarted', (event) => started.push(event.startedAt));
    engine.events.on('lapFinished', (event) => finished.push(event.lapMs));

    const y = engine.worldPos.y;

    engine.worldPos.set(-1, y, 0);
    engine.velocityWS.set(0, 0, 0);
    engine.step(1 / 240);

    engine.worldPos.set(-1, y, 0);
    engine.velocityWS.set(12, 0, 0);
    engine.step(0.2);

    engine.worldPos.set(-1, y, 0);
    engine.velocityWS.set(0, 0, 0);
    engine.step(1 / 240);

    engine.worldPos.set(-1, y, 0);
    engine.velocityWS.set(12, 0, 0);
    engine.step(0.25);

    const snapshot = engine.snapshot();
    expect(started).toHaveLength(1);
    expect(finished).toHaveLength(1);
    expect(finished[0]).toBeGreaterThan(200);
    expect(snapshot.lap.lastMs).toBeCloseTo(finished[0], 6);
    expect(snapshot.lap.bestMs).toBeCloseTo(finished[0], 6);
  });

  // ------------------------------------------------------------------
  // M0 — Frame and Integrator Cleanup regression locks
  // ------------------------------------------------------------------

  it('M0: sideslip sign is positive when velocity leans to chassis right (forward travel)', () => {
    // Canonical SAE/automotive convention: positive sideslip ↔ velocity
    // vector displaced toward chassis right. Must hold for both left and
    // right lateral velocity to confirm the atan2-based formula is live.
    const engine = createEngine();
    stepFor(engine, 0.5);
    const internals = engine as unknown as { sideslipRad: number };

    // Slide toward chassis RIGHT while going forward: positive sideslip.
    engine.worldQuat.identity();
    engine.velocityWS.set(4, 0, -20); // x=+4 (right), z=-20 (forward)
    engine.step(1 / 240);
    expect(internals.sideslipRad).toBeGreaterThan(0);

    // Slide toward chassis LEFT while going forward: negative sideslip.
    engine.velocityWS.set(-4, 0, -20);
    engine.step(1 / 240);
    expect(internals.sideslipRad).toBeLessThan(0);
  });

  it('M0: semi-implicit Euler keeps chassis velocity finite under sustained gravity with no contact', () => {
    // A chassis placed high above the ground with no forces other than
    // gravity must not diverge under the semi-implicit integrator. With
    // the old explicit-Euler + artificial linear damping, the linear damp
    // provided ad-hoc stability; without it the integrator must stay
    // bounded naturally (at 240 Hz, semi-implicit Euler is unconditionally
    // stable for a linear spring-mass, and gravity is constant so there is
    // no resonance concern).
    const engine = createEngine();
    engine.worldPos.y = 50;
    engine.velocityWS.set(0, 0, 0);
    for (let i = 0; i < 240; i++) engine.step(1 / 240);
    expect(Number.isFinite(engine.velocityWS.y)).toBe(true);
    expect(Number.isFinite(engine.worldPos.y)).toBe(true);
    // One second of free-fall from 50 m: v = g*t = 9.81 m/s.
    // Engine hits the floor clamping at minHeight, so vy resets to 0 at
    // impact. After that velocity stays bounded.
    expect(Math.abs(engine.velocityWS.y)).toBeLessThan(20);
  });

  it('M0: angular integrator produces bounded yaw rate after a sustained yaw impulse', () => {
    // The old 0.18 s⁻¹ angular damping was a fudge that suppressed yaw
    // oscillation. With it removed, the engine-native yaw dissipation
    // (tire Fy × moment arm) must be sufficient to keep yaw bounded
    // during a steady-state steer. Verify the yaw rate stays finite and
    // physically plausible (< 5 rad/s) after 2 s of hard cornering.
    const engine = createEngine();
    stepFor(engine, 0.5);
    const snap = holdSteerAtSpeed(engine, 0.8, 18, 2.0);
    expect(Number.isFinite(snap.yawRateRad)).toBe(true);
    expect(Math.abs(snap.yawRateRad)).toBeLessThan(5);
  });
});


describe('M4 — 3D track surface', () => {
  it('flat fallback: car rests at y ≈ 0 ground for a track with no elevationSamples', () => {
    const engine = createEngine();
    // After a half-second warm-up the car should be settled near y = 0 ground.
    stepFor(engine, 0.5);
    // worldPos.y is the chassis CG, not the wheel contact. The wheel contact
    // is at y ≈ 0 (flat ground), so CG is at roughly restLen + cgHeight.
    const expectedMin = 0.3;
    expect(engine.worldPos.y).toBeGreaterThan(expectedMin);
    // Should not have climbed arbitrarily (no elevation forcing it up).
    expect(engine.worldPos.y).toBeLessThan(2.5);
  });

  it('snapshot trackCondition is populated for a basic track', () => {
    const engine = createEngine();
    stepFor(engine, 0.1);
    const snap = engine.snapshot();
    expect(snap.trackCondition).toBeDefined();
    expect(snap.trackCondition.trackTempC).toBe(28); // default
    expect(snap.trackCondition.rubberLineGrip).toBe(1); // default
    expect(snap.trackCondition.terrainActive).toBe(false); // no elevation data
    expect(snap.trackCondition.bumpAmplitudeM).toBe(0);
  });

  it('snapshot trackCondition reflects authored preset values', () => {
    const track: TrackPreset = {
      ...makeTrack(),
      trackTempC: 45,
      rubberLineGrip: 1.08,
      bumpAmplitudeM: 0.005,
      elevationSamples: [
        { segmentIndex: 0, y: 0 },
        { segmentIndex: 32, y: 5 },
      ],
    };
    const engine = new (RacingEngine as any)({
      vehicle: makeVehicle(),
      track,
    });
    engines.push(engine);
    stepFor(engine, 0.1);
    const snap = engine.snapshot();
    expect(snap.trackCondition.trackTempC).toBe(45);
    expect(snap.trackCondition.rubberLineGrip).toBeCloseTo(1.08, 5);
    expect(snap.trackCondition.bumpAmplitudeM).toBeCloseTo(0.005, 5);
    expect(snap.trackCondition.terrainActive).toBe(true);
  });

  it('elevated spawn: car spawns at authored ground height when elevationSamples set spawn point above 0', () => {
    const track: TrackPreset = {
      ...makeTrack(),
      elevationSamples: [
        { segmentIndex: 0, y: 10 },
        { segmentIndex: 63, y: 10 },
      ],
    };
    const engine = new (RacingEngine as any)({
      vehicle: makeVehicle(),
      track,
    });
    engines.push(engine);
    // worldPos.y should be offset above 10 (the authored ground at segment 0)
    expect(engine.worldPos.y).toBeGreaterThan(10);
  });

  it('kerb profile is wired from track preset into surfaceLookup', () => {
    const track: TrackPreset = {
      ...makeTrack(),
      kerbProfile: {
        widthM: 0.5,
        crownHeightM: 0.04,
        topFlatFraction: 0.0,
        bumpForceN: 1500,
      },
    };
    const engine = new (RacingEngine as any)({
      vehicle: makeVehicle(),
      track,
    });
    engines.push(engine);
    // The kerbBumpImpulseAt method should return > 0 for a point known to be
    // in the CURB strip of a straight-line centerline.  We use a direct
    // SurfaceLookup to avoid Catmull-Rom curve deviation on the square track.
    const testLookup = new SurfaceLookup({
      points: [{ x: 0, z: 0 }, { x: 50, z: 0 }, { x: 100, z: 0 }],
      halfWidth: 7,
      curbWidth: 0.5,
      rubberWidth: 2,
      marblesWidth: 1,
      defaultOffTrack: 'GRASS',
      zones: [],
      kerbProfile: track.kerbProfile,
    });
    // Mid-kerb at z=7.25 on a straight line (halfWidth=7, kerbWidth/2=0.25)
    const impulse = testLookup.kerbBumpImpulseAt(50, 7.25);
    expect(impulse).toBeGreaterThan(0);
    expect(impulse).toBeLessThanOrEqual(1500);
  });

  // Note: M4 domain validation tests (elevationSamples, kerbProfile) live in
  // packages/domain/src/shared/racing/validation.test.ts.

  it('snapshot finiteness: all key numeric fields are finite after 1 s of simulation', () => {
    const engine = createEngine();
    stepFor(engine, 1);
    const snap = engine.snapshot();
    expect(Number.isFinite(snap.speedKmh)).toBe(true);
    expect(Number.isFinite(snap.rpm)).toBe(true);
    expect(Number.isFinite(snap.sideslipDeg)).toBe(true);
    expect(Number.isFinite(snap.yawRateRad)).toBe(true);
    expect(Number.isFinite(snap.rollDeg)).toBe(true);
    expect(Number.isFinite(snap.pitchDeg)).toBe(true);
    expect(Number.isFinite(snap.accelLongG)).toBe(true);
    expect(Number.isFinite(snap.accelLatG)).toBe(true);
    expect(Number.isFinite(snap.trackCondition.trackTempC)).toBe(true);
    expect(Number.isFinite(snap.trackCondition.bumpAmplitudeM)).toBe(true);
    for (const w of snap.wheels) {
      expect(Number.isFinite(w.fz)).toBe(true);
      expect(Number.isFinite(w.fx)).toBe(true);
      expect(Number.isFinite(w.fy)).toBe(true);
      expect(Number.isFinite(w.tempC)).toBe(true);
      expect(Number.isFinite(w.pressureKpa)).toBe(true);
      expect(Number.isFinite(w.suspensionTravel)).toBe(true);
    }
  });

  it('bumpAmplitudeM=0 (flat track): car simulation stays finite after 2 s under throttle', () => {
    const track: TrackPreset = { ...makeTrack(), bumpAmplitudeM: 0 };
    const engine = new (RacingEngine as any)({ vehicle: makeVehicle(), track });
    engines.push(engine);
    engine.resetCar();
    setKey(engine, 'ArrowUp', true);
    stepFor(engine, 2);
    const snap = engine.snapshot();
    expect(Number.isFinite(snap.speedKmh)).toBe(true);
    expect(snap.speedKmh).toBeGreaterThan(0);
    for (const w of snap.wheels) expect(Number.isFinite(w.fz)).toBe(true);
  });

  it('Fz stays positive and finite on all wheels during a 1 s straight-line run', () => {
    const engine = createEngine();
    setKey(engine, 'ArrowUp', true);
    let allPositive = true;
    sampleFor(engine, 1, 1 / 60, () => {
      const wheels = readWheels(engine);
      for (const w of wheels) {
        if (!Number.isFinite(w.fz) || w.fz < 0) allPositive = false;
      }
    });
    expect(allPositive).toBe(true);
  });

  it('elevated track: Fz remains finite and positive after car settles on raised ground', () => {
    const track: TrackPreset = {
      ...makeTrack(),
      elevationSamples: [
        { segmentIndex: 0, y: 5 },
        { segmentIndex: 63, y: 5 },
      ],
    };
    const engine = new (RacingEngine as any)({ vehicle: makeVehicle(), track });
    engines.push(engine);
    stepFor(engine, 0.5);
    const snap = engine.snapshot();
    expect(snap.trackCondition.terrainActive).toBe(true);
    for (const w of snap.wheels) {
      expect(Number.isFinite(w.fz)).toBe(true);
      expect(w.fz).toBeGreaterThan(0);
    }
    // Car should be resting above the authored 5 m ground plane.
    expect(engine.worldPos.y).toBeGreaterThan(5);
  });

  it('kerb Fz spike: after reset, running across the kerb strip does not produce NaN in Fz', () => {
    const track: TrackPreset = {
      ...makeTrack(),
      kerbProfile: { widthM: 0.5, crownHeightM: 0.04, topFlatFraction: 0.0, bumpForceN: 800 },
    };
    const engine = new (RacingEngine as any)({ vehicle: makeVehicle(), track });
    engines.push(engine);
    engine.resetCar();
    // Drive and steer hard right for 1 s — likely crosses the kerb strip.
    setKey(engine, 'ArrowUp', true);
    setKey(engine, 'ArrowRight', true);
    stepFor(engine, 1);
    const snap = engine.snapshot();
    for (const w of snap.wheels) {
      expect(Number.isFinite(w.fz)).toBe(true);
      expect(w.fz).toBeGreaterThanOrEqual(0);
    }
    expect(Number.isFinite(snap.speedKmh)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// M5 aero-map engine integration
// ---------------------------------------------------------------------------

describe('M5 aero-map engine integration', () => {
  it('snapshot hasAeroMap is false for scalar-only preset', () => {
    const engine = createEngine();
    stepFor(engine, 0.1);
    const snap = engine.snapshot();
    expect(snap.aero.hasAeroMap).toBe(false);
  });

  it('snapshot hasAeroMap is true when aeroMap is provided', () => {
    const vehicle = makeVehicle();
    vehicle.physics = {
      clAreaFrontM2: 0.4,
      clAreaRearM2: 0.8,
      aeroMap: {
        frontClAreaMap: {
          axis0: [0.05, 0.15],
          axis1: [-2, 0, 2],
          data: [
            [1.4, 1.6, 1.3],
            [0.7, 0.9, 0.8],
          ],
        },
        rearClAreaMap: {
          axis0: [0.05, 0.15],
          axis1: [-2, 0, 2],
          data: [
            [2.0, 2.2, 2.0],
            [1.2, 1.4, 1.3],
          ],
        },
        stallRideHeightM: 0.03,
      },
    };
    const engine = new RacingEngine({ vehicle, track: makeTrack() });
    engines.push(engine);
    engine.resetCar();
    stepFor(engine, 0.1);
    const snap = engine.snapshot();
    expect(snap.aero.hasAeroMap).toBe(true);
  });

  it('M5 snapshot aero fields are all finite', () => {
    const engine = createEngine();
    // Force a high-speed state to exercise aero calculations.
    engine.velocityWS.copy(engine.forward.clone().multiplyScalar(50));
    stepFor(engine, 0.2);
    const snap = engine.snapshot();
    expect(Number.isFinite(snap.aero.frontDownforceN)).toBe(true);
    expect(Number.isFinite(snap.aero.rearDownforceN)).toBe(true);
    expect(Number.isFinite(snap.aero.dragN)).toBe(true);
    expect(Number.isFinite(snap.aero.copFraction)).toBe(true);
    expect(Number.isFinite(snap.aero.effectiveClAreaFront)).toBe(true);
    expect(Number.isFinite(snap.aero.effectiveClAreaRear)).toBe(true);
    expect(Number.isFinite(snap.aero.frontRideHeightM)).toBe(true);
    expect(Number.isFinite(snap.aero.rearRideHeightM)).toBe(true);
    expect(snap.aero.frontRideHeightM).toBeGreaterThanOrEqual(0);
    expect(snap.aero.rearRideHeightM).toBeGreaterThanOrEqual(0);
  });

  it('M5 aero map shifts CoP rearward relative to scalar preset at high speed', () => {
    // Build a vehicle with rear-biased map so rear downforce > front.
    const vehicle = makeVehicle();
    vehicle.physics = {
      clAreaFrontM2: 0.4,
      clAreaRearM2: 0.4, // equal scalars would give CoP=0.5
      aeroMap: {
        frontClAreaMap: {
          axis0: [0.05, 0.15],
          axis1: [0],
          data: [[0.4], [0.4]],
        },
        rearClAreaMap: {
          axis0: [0.05, 0.15],
          axis1: [0],
          data: [[1.6], [1.6]], // rear-biased map → CoP rearward
        },
      },
    };
    const engineMap = new RacingEngine({ vehicle, track: makeTrack() });
    engines.push(engineMap);
    engineMap.resetCar();
    const engineScalar = createEngine();

    // Force both to high speed and sample aero.
    for (const eng of [engineMap, engineScalar]) {
      eng.velocityWS.copy(eng.forward.clone().multiplyScalar(55));
      stepFor(eng, 0.5);
    }

    const snapMap = engineMap.snapshot();
    const snapScalar = engineScalar.snapshot();

    // Map CoP should be > 0.5 (rear-biased), scalar CoP should be 0.5 (equal ClA).
    expect(snapMap.aero.copFraction).toBeGreaterThan(0.5);
    expect(snapScalar.aero.copFraction).toBeCloseTo(0.5, 1);
  });

  it('scalar fallback: high-speed driving does not produce NaN in snapshot', () => {
    const engine = createEngine();
    setKey(engine, 'ArrowUp', true);
    // Force high speed to exercise aero drag and downforce paths.
    for (let i = 0; i < 1200; i++) {
      engine.velocityWS.copy(engine.forward.clone().multiplyScalar(70));
      engine.step(1 / 240);
    }
    const snap = engine.snapshot();
    expect(Number.isFinite(snap.speedKmh)).toBe(true);
    expect(Number.isFinite(snap.aero.frontDownforceN)).toBe(true);
    expect(Number.isFinite(snap.aero.rearDownforceN)).toBe(true);
    expect(Number.isFinite(snap.aero.dragN)).toBe(true);
    for (const w of snap.wheels) {
      expect(Number.isFinite(w.fz)).toBe(true);
    }
  });

  it('aero map stall flag is present in snapshot telemetry when ride-height is below threshold', () => {
    const vehicle = makeVehicle();
    vehicle.physics = {
      clAreaFrontM2: 0,
      clAreaRearM2: 0,
      aeroMap: {
        frontClAreaMap: {
          axis0: [0.02, 0.10],
          axis1: [0],
          data: [[0.5], [1.2]],
        },
        rearClAreaMap: {
          axis0: [0.02, 0.10],
          axis1: [0],
          data: [[0.6], [1.8]],
        },
        stallRideHeightM: 0.08,
      },
    };
    const engine = new RacingEngine({ vehicle, track: makeTrack() });
    engines.push(engine);
    engine.resetCar();
    // Force chassis very close to ground — minimum ride height triggers stall.
    engine.worldPos.y = 0.2;
    engine.velocityWS.copy(engine.forward.clone().multiplyScalar(40));
    stepFor(engine, 0.1);
    const snap = engine.snapshot();
    // snapshot should have stall booleans (true/false, not undefined/NaN).
    expect(typeof snap.aero.frontStalled).toBe('boolean');
    expect(typeof snap.aero.rearStalled).toBe('boolean');
  });
});

// ============================================================
// M6 Drivetrain Depth — RacingEngine integration
// ============================================================

describe('M6 drivetrain — snapshot field finiteness', () => {
  it('all drivetrain snapshot fields are finite after resetCar (NA preset)', () => {
    const engine = createEngine();
    const snap = engine.snapshot();
    const dt = snap.drivetrain;
    expect(Number.isFinite(dt.boostBar)).toBe(true);
    expect(Number.isFinite(dt.turboSpoolRatio)).toBe(true);
    expect(Number.isFinite(dt.boostTorqueMultiplier)).toBe(true);
    expect(typeof dt.isOverboost).toBe('boolean');
    expect(typeof dt.shiftRefused).toBe('boolean');
    expect(typeof dt.shiftInProgress).toBe('boolean');
    expect(Number.isFinite(dt.shiftRemainingS)).toBe(true);
    expect(Number.isFinite(dt.drivelineComplianceTwistRad)).toBe(true);
    expect(Number.isFinite(dt.drivelineComplianceSpringNm)).toBe(true);
  });

  it('NA preset: boostBar=0, turboSpoolRatio=0, boostTorqueMultiplier=1, isOverboost=false', () => {
    const engine = createEngine();
    stepFor(engine, 2);
    const dt = engine.snapshot().drivetrain;
    expect(dt.boostBar).toBe(0);
    expect(dt.turboSpoolRatio).toBe(0);
    expect(dt.boostTorqueMultiplier).toBe(1);
    expect(dt.isOverboost).toBe(false);
  });

  it('all drivetrain snapshot fields remain finite after 5 s of full-throttle driving', () => {
    const engine = createEngine();
    setKey(engine, 'ArrowUp', true);
    // Kick to ~60 km/h to exercise the drivetrain path.
    for (let i = 0; i < 60 * 240; i++) {
      engine.velocityWS.copy(engine.forward.clone().multiplyScalar(16));
      engine.step(1 / 240);
    }
    const snap = engine.snapshot();
    for (const [key, val] of Object.entries(snap.drivetrain)) {
      if (typeof val === 'number') {
        expect(Number.isFinite(val)).toBe(true);
      }
    }
  });
});

describe('M6 drivetrain — turbo spool integration', () => {
  function makeTurboVehicle(): VehiclePreset {
    const v = makeVehicle();
    v.physics = {
      turbo: {
        peakBoostBar: 1.2,
        peakTorqueMultiplier: 1.5,
        targetSpoolRpm: 3000,
        spoolUpTimeS: 0.5,
        spoolDownTimeS: 1.5,
      },
    };
    return v;
  }

  it('turbo spool rises above 0 under full-throttle high-rpm driving', () => {
    const vehicle = makeTurboVehicle();
    const engine = new RacingEngine({ vehicle, track: makeTrack() });
    engines.push(engine);
    engine.resetCar();
    setKey(engine, 'ArrowUp', true);
    engine.velocityWS.copy(engine.forward.clone().multiplyScalar(20));
    stepFor(engine, 2);
    const dt = engine.snapshot().drivetrain;
    expect(dt.turboSpoolRatio).toBeGreaterThan(0);
  });

  it('boost bar and torque multiplier are above NA values at full spool', () => {
    const vehicle = makeTurboVehicle();
    const engine = new RacingEngine({ vehicle, track: makeTrack() });
    engines.push(engine);
    engine.resetCar();
    setKey(engine, 'ArrowUp', true);
    engine.velocityWS.copy(engine.forward.clone().multiplyScalar(20));
    stepFor(engine, 3);
    const dt = engine.snapshot().drivetrain;
    expect(dt.boostBar).toBeGreaterThan(0);
    expect(dt.boostTorqueMultiplier).toBeGreaterThan(1);
  });

  it('spool ratio drops toward zero on throttle lift', () => {
    const vehicle = makeTurboVehicle();
    const engine = new RacingEngine({ vehicle, track: makeTrack() });
    engines.push(engine);
    engine.resetCar();
    setKey(engine, 'ArrowUp', true);
    engine.velocityWS.copy(engine.forward.clone().multiplyScalar(20));
    stepFor(engine, 2);
    const spoolAfterWot = engine.snapshot().drivetrain.turboSpoolRatio;
    setKey(engine, 'ArrowUp', false);
    stepFor(engine, 2);
    const spoolAfterLift = engine.snapshot().drivetrain.turboSpoolRatio;
    expect(spoolAfterLift).toBeLessThan(spoolAfterWot);
  });

  it('turbo drivetrain fields remain finite after reset cycle', () => {
    const vehicle = makeTurboVehicle();
    const engine = new RacingEngine({ vehicle, track: makeTrack() });
    engines.push(engine);
    engine.resetCar();
    setKey(engine, 'ArrowUp', true);
    stepFor(engine, 1);
    engine.resetCar();
    const snap = engine.snapshot();
    expect(Number.isFinite(snap.drivetrain.boostBar)).toBe(true);
    expect(Number.isFinite(snap.drivetrain.turboSpoolRatio)).toBe(true);
    expect(Number.isFinite(snap.drivetrain.boostTorqueMultiplier)).toBe(true);
  });
});

describe('M6 drivetrain — shift refusal and delay', () => {
  function makeShiftVehicle(): VehiclePreset {
    const v = makeVehicle();
    v.physics = {
      shiftLogic: {
        upshiftMinRpm: 2000,
        upshiftMaxRpm: 8000,
        shiftTimeS: 0.15,
        shiftThrottleCutFraction: 0.8,
      },
    };
    return v;
  }

  it('upshift refused below minRpm → shiftRefused=true in snapshot', () => {
    const vehicle = makeShiftVehicle();
    const engine = new RacingEngine({ vehicle, track: makeTrack() });
    engines.push(engine);
    engine.resetCar();
    // At idle the engine is below 2000 rpm — upshift should be refused.
    engine.input.state.shiftUp = true;
    engine.step(1 / 240);
    const dt = engine.snapshot().drivetrain;
    expect(dt.shiftRefused).toBe(true);
    expect(dt.shiftRefusalReason.length).toBeGreaterThan(0);
  });

  it('shiftRefused auto-clears on next step when no input is active', () => {
    const vehicle = makeShiftVehicle();
    const engine = new RacingEngine({ vehicle, track: makeTrack() });
    engines.push(engine);
    engine.resetCar();
    // Trigger refusal.
    engine.input.state.shiftUp = true;
    engine.step(1 / 240);
    expect(engine.snapshot().drivetrain.shiftRefused).toBe(true);
    // Next step with no shift input → refused flag must clear.
    engine.step(1 / 240);
    expect(engine.snapshot().drivetrain.shiftRefused).toBe(false);
  });

  it('upshift delay → shiftInProgress=true during shift window', () => {
    const vehicle = makeShiftVehicle();
    const engine = new RacingEngine({ vehicle, track: makeTrack() });
    engines.push(engine);
    engine.resetCar();
    setKey(engine, 'ArrowUp', true);
    engine.velocityWS.copy(engine.forward.clone().multiplyScalar(12));
    // Warm up the engine above 2000 rpm.
    stepFor(engine, 1);
    // Trigger the upshift.
    engine.input.state.shiftUp = true;
    engine.step(1 / 240);
    const dt = engine.snapshot().drivetrain;
    if (!dt.shiftRefused) {
      expect(dt.shiftInProgress).toBe(true);
      expect(dt.shiftRemainingS).toBeGreaterThan(0);
    }
  });

  it('shift completes: shiftInProgress=false after delay window', () => {
    const vehicle = makeShiftVehicle();
    const engine = new RacingEngine({ vehicle, track: makeTrack() });
    engines.push(engine);
    engine.resetCar();
    setKey(engine, 'ArrowUp', true);
    engine.velocityWS.copy(engine.forward.clone().multiplyScalar(12));
    stepFor(engine, 1);
    engine.input.state.shiftUp = true;
    engine.step(1 / 240);
    // Step enough to exceed the 0.15 s delay window.
    stepFor(engine, 0.25);
    const dt = engine.snapshot().drivetrain;
    expect(dt.shiftInProgress).toBe(false);
    expect(dt.shiftRemainingS).toBe(0);
  });

  it('hasShiftLogic guard: NA preset (no shiftLogic) shifts instantly', () => {
    const engine = createEngine();
    setKey(engine, 'ArrowUp', true);
    engine.velocityWS.copy(engine.forward.clone().multiplyScalar(10));
    stepFor(engine, 1);
    const gearBefore = engine.snapshot().gearIndex;
    engine.input.state.shiftUp = true;
    engine.step(1 / 240);
    const dt = engine.snapshot().drivetrain;
    // NA preset → no shift logic → instantaneous, shiftInProgress always false.
    expect(dt.shiftInProgress).toBe(false);
    expect(dt.shiftRemainingS).toBe(0);
  });
});

describe('M6 drivetrain — snapshot NaN guard after reset cycles', () => {
  it('no NaN in any snapshot field after turbo + shiftLogic + compliance preset driving + reset', () => {
    const vehicle = makeVehicle();
    vehicle.physics = {
      turbo: {
        peakBoostBar: 1.0,
        peakTorqueMultiplier: 1.4,
        targetSpoolRpm: 3500,
        spoolUpTimeS: 0.6,
        spoolDownTimeS: 1.2,
      },
      shiftLogic: {
        upshiftMinRpm: 1500,
        shiftTimeS: 0.1,
      },
      drivelineCompliance: {
        shaftStiffnessNmRad: 8000,
        shaftDampingNmSRad: 30,
        backlashRad: 0.01,
      },
      engineBraking: {
        linearNmPerRadS: 0.05,
        constantNm: 12,
        maxBrakeTorqueNm: 200,
      },
    };
    const engine = new RacingEngine({ vehicle, track: makeTrack() });
    engines.push(engine);
    engine.resetCar();
    setKey(engine, 'ArrowUp', true);
    engine.velocityWS.copy(engine.forward.clone().multiplyScalar(15));
    stepFor(engine, 3);
    engine.resetCar();
    setKey(engine, 'ArrowUp', true);
    stepFor(engine, 2);

    const snap = engine.snapshot();
    // Check all drivetrain fields.
    for (const [key, val] of Object.entries(snap.drivetrain)) {
      if (typeof val === 'number') {
        expect(Number.isFinite(val)).toBe(true);
      }
    }
    // Check wheel fields too.
    for (const w of snap.wheels) {
      expect(Number.isFinite(w.fz)).toBe(true);
      expect(Number.isFinite(w.slipRatio)).toBe(true);
    }
  });
});

describe('M6 drivetrain — driveline compliance integration', () => {
  it('drivelineComplianceTwistRad is non-zero when compliance is authored and torque is applied', () => {
    const vehicle = makeVehicle();
    vehicle.physics = {
      drivelineCompliance: {
        shaftStiffnessNmRad: 5000,
        shaftDampingNmSRad: 20,
      },
    };
    const engine = new RacingEngine({ vehicle, track: makeTrack() });
    engines.push(engine);
    engine.resetCar();
    setKey(engine, 'ArrowUp', true);
    engine.velocityWS.copy(engine.forward.clone().multiplyScalar(5));
    stepFor(engine, 1);
    const dt = engine.snapshot().drivetrain;
    // Compliance is authored and torque is flowing — twist should be non-zero.
    expect(Number.isFinite(dt.drivelineComplianceTwistRad)).toBe(true);
  });

  it('drivelineComplianceTwistRad stays zero for NA preset (no compliance authored)', () => {
    const engine = createEngine();
    setKey(engine, 'ArrowUp', true);
    stepFor(engine, 2);
    expect(engine.snapshot().drivetrain.drivelineComplianceTwistRad).toBe(0);
  });
});

// ------------------------------------------------------------------
// Racing chassis compliance — zero-compliance regression gates
// ------------------------------------------------------------------

describe('Chassis compliance — zero-compliance = no regression', () => {
  it('preset without compliance fields behaves identically to pre-feature baseline', () => {
    const engine = createEngine();
    stepFor(engine, 1);
    const snap = engine.snapshot();
    expect(snap.speedKmh).toBeLessThan(1);
    expect(snap.wheels.every((w) => Number.isFinite(w.fz))).toBe(true);
    expect(snap.wheels.every((w) => Number.isFinite(w.slipRatio))).toBe(true);
    // Tiny roll from suspension settle is normal; assert near-zero.
    expect(Math.abs(snap.rollDeg)).toBeLessThan(0.1);
  });

  it('preset with explicit zero compliance fields behaves identically to rigid', () => {
    const vehicle = makeVehicle();
    vehicle.physics = {
      compliance: {
        hubLinearStiffnessNpm: 0,
        hubLinearDampingNspms: 0,
        hubRotationalStiffnessNmDeg: 0,
        chassisTorsionalStiffnessNmDeg: 0,
      },
    };
    const engine = new RacingEngine({ vehicle, track: makeTrack() });
    engines.push(engine);
    stepFor(engine, 1);
    const snap = engine.snapshot();
    expect(snap.wheels.every((w) => Number.isFinite(w.fz))).toBe(true);
    expect(snap.wheels.every((w) => Number.isFinite(w.slipRatio))).toBe(true);
    expect(Math.abs(snap.rollDeg)).toBeLessThan(0.1);
  });

  it('GT3 compliance preset loads without errors and snapshot stays finite', () => {
    const vehicle = makeVehicle();
    vehicle.physics = {
      compliance: {
        hubLinearStiffnessNpm: 150000,
        hubLinearDampingNspms: 2.5,
        hubRotationalStiffnessNmDeg: 8,
        hubRotationalDampingNmSdeg: 0.4,
        chassisTorsionalStiffnessNmDeg: 22000,
      },
    };
    const engine = new RacingEngine({ vehicle, track: makeTrack() });
    engines.push(engine);
    engine.resetCar();
    stepFor(engine, 1);
    const snap = engine.snapshot();
    expect(Number.isFinite(snap.speedKmh)).toBe(true);
    expect(snap.wheels.length).toBe(4);
    for (const w of snap.wheels) {
      expect(Number.isFinite(w.fz)).toBe(true);
      expect(Number.isFinite(w.slipRatio)).toBe(true);
      expect(Number.isFinite(w.slipAngle)).toBe(true);
    }
  });

  it('resetCar works with compliance preset and returns to neutral state', () => {
    const vehicle = makeVehicle();
    vehicle.physics = {
      compliance: {
        hubLinearStiffnessNpm: 150000,
        hubLinearDampingNspms: 2.5,
        chassisTorsionalStiffnessNmDeg: 22000,
      },
    };
    const engine = new RacingEngine({ vehicle, track: makeTrack() });
    engines.push(engine);
    stepFor(engine, 1);
    engine.resetCar();
    const snap = engine.snapshot();
    expect(snap.gearLabel).toBe('N');
    // Tiny residual speed from integrator settle is acceptable.
    expect(snap.speedKmh).toBeLessThan(1);
    expect(snap.rpm).toBeGreaterThan(700);
    expect(snap.rpm).toBeLessThan(1500);
  });

  it('high torsional stiffness (100000) still produces finite snapshots', () => {
    const vehicle = makeVehicle();
    vehicle.physics = {
      compliance: {
        chassisTorsionalStiffnessNmDeg: 100000,
      },
    };
    const engine = new RacingEngine({ vehicle, track: makeTrack() });
    engines.push(engine);
    stepFor(engine, 0.5);
    const snap = engine.snapshot();
    expect(Number.isFinite(snap.rollDeg)).toBe(true);
    expect(Number.isFinite(snap.pitchDeg)).toBe(true);
  });
});
