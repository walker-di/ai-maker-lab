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
    expect(leftTurn.accelLatG).toBeLessThan(0);
    expect(rightTurn.accelLatG).toBeGreaterThan(0);
    expect(leftTurn.sideslipDeg).toBeGreaterThan(0);
    expect(rightTurn.sideslipDeg).toBeLessThan(0);

    // Mirror checks: precision 1 (tolerance 0.05) for the higher-magnitude
    // chassis responses, but precision 0 (tolerance 0.5) for sideslipDeg
    // because near-straight sideslip is a small-magnitude value where tiny
    // integration asymmetries (amplified by the SAE-style Gyk that preserves
    // more lateral force at low slipRatio) show up as relative noise. The
    // strict sign mirrors above already lock direction.
    expect(leftTurn.rollDeg).toBeCloseTo(-rightTurn.rollDeg, 1);
    expect(leftTurn.yawRateRad).toBeCloseTo(-rightTurn.yawRateRad, 1);
    expect(leftTurn.accelLatG).toBeCloseTo(-rightTurn.accelLatG, 1);
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
