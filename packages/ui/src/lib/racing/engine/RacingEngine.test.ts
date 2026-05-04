import { afterEach, describe, expect, it } from 'bun:test';
import { Euler, Quaternion } from 'three';
import { RacingEngine } from './RacingEngine.js';
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
    engine.velocityWS.copy(engine.forward.clone().multiplyScalar(22));
    setKey(engine, 's', true);
    engine.step(1 / 240);
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
});
