import { afterEach, describe, expect, it } from 'bun:test';
import { Quaternion, Vector3 } from 'three';
import { RacingEngine } from './RacingEngine.js';
import type { TrackPreset, VehiclePreset } from '../types.js';

function makeVehicle(): VehiclePreset {
  return {
    id: 'test-rwd-m8',
    label: 'Test RWD M8',
    driveLabel: 'RWD',
    layoutLabel: 'Front-mid',
    color: 0xaa2200,
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
    physics: { brakeTorqueMaxNm: 5200 },
  };
}

function makeTrack(overrides: Partial<TrackPreset> = {}): TrackPreset {
  return {
    id: 'test-m8-track',
    label: 'Test M8 Track',
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
    ...overrides,
  };
}

const engines: RacingEngine[] = [];

function makeEngine(track: TrackPreset = makeTrack()): RacingEngine {
  const engine = new RacingEngine({ vehicle: makeVehicle(), track });
  engines.push(engine);
  return engine;
}

function stepFor(engine: RacingEngine, seconds: number, dt = 1 / 240): void {
  const steps = Math.ceil(seconds / dt);
  for (let i = 0; i < steps; i++) engine.step(dt);
}

function press(engine: RacingEngine, key: string): void {
  const input = engine.input as unknown as { onKeyDown: (event: { key: string }) => void };
  input.onKeyDown({ key });
}

function release(engine: RacingEngine, key: string): void {
  const input = engine.input as unknown as { onKeyUp: (event: { key: string }) => void };
  input.onKeyUp({ key });
}

function settle(engine: RacingEngine): void {
  stepFor(engine, 0.75);
}

function forceSlidingState(engine: RacingEngine): void {
  engine.worldQuat.identity();
  engine.velocityWS.set(12, 0, -24);
  const internals = engine as unknown as {
    prevLocalVelocity: { set: (x: number, y: number, z: number) => void };
  };
  internals.prevLocalVelocity.set(12, 0, -24);
}

function forceBrakeLockState(engine: RacingEngine): void {
  engine.worldQuat.identity();
  engine.velocityWS.set(0, 0, -26);
  const internals = engine as unknown as {
    prevLocalVelocity: { set: (x: number, y: number, z: number) => void };
    wheels: Array<{ omega: number }>;
  };
  internals.prevLocalVelocity.set(0, 0, -26);
  for (const wheel of internals.wheels) wheel.omega = 0;
}

afterEach(() => {
  for (const engine of engines.splice(0)) engine.dispose();
});

describe('RacingEngine M8 tire polish snapshot fields', () => {
  it('exposes finite reset defaults for tire wear, flat spots, and track condition', () => {
    const engine = makeEngine();
    engine.resetCar();
    const snap = engine.snapshot();

    expect(snap.trackCondition.wetness).toBe(0);
    expect(snap.trackCondition.condition).toBe('dry');
    for (const wheel of snap.wheels) {
      expect(wheel.tireWear).toBe(0);
      expect(wheel.flatSpotSignal).toBe(0);
      expect(Number.isFinite(wheel.tireWear)).toBe(true);
      expect(Number.isFinite(wheel.flatSpotSignal)).toBe(true);
    }
  });

  it('forwards authored wetness and condition when a track preset exposes them', () => {
    const engine = makeEngine(makeTrack({ wetness: 0.42, condition: 'damp' }));
    const snap = engine.snapshot();

    expect(snap.trackCondition.wetness).toBeCloseTo(0.42);
    expect(snap.trackCondition.condition).toBe('damp');
  });

  it('increases tire wear deterministically under a sustained slide', () => {
    const engine = makeEngine();
    settle(engine);
    const before = engine.snapshot().wheels.map((wheel) => wheel.tireWear);

    for (let i = 0; i < 120; i++) {
      forceSlidingState(engine);
      engine.step(1 / 240);
    }

    const after = engine.snapshot().wheels.map((wheel) => wheel.tireWear);
    expect(after.some((wear, index) => wear > before[index])).toBe(true);
    for (const wear of after) {
      expect(Number.isFinite(wear)).toBe(true);
      expect(wear).toBeGreaterThanOrEqual(0);
      expect(wear).toBeLessThanOrEqual(1);
    }
  });

  it('can produce a flat-spot signal under a locked hard-braking scenario', () => {
    const engine = makeEngine();
    settle(engine);
    press(engine, 'ArrowDown');

    for (let i = 0; i < 90; i++) {
      forceBrakeLockState(engine);
      engine.step(1 / 240);
    }
    release(engine, 'ArrowDown');

    const flatSpots = engine.snapshot().wheels.map((wheel) => wheel.flatSpotSignal);
    expect(flatSpots.some((signal) => signal > 0)).toBe(true);
    for (const signal of flatSpots) {
      expect(Number.isFinite(signal)).toBe(true);
      expect(signal).toBeGreaterThanOrEqual(0);
      expect(signal).toBeLessThanOrEqual(1);
    }
  });

  it('reports wakeReduction = 0 when no lead car is set', () => {
    const engine = makeEngine();
    settle(engine);
    engine.step(1 / 240);
    expect(engine.snapshot().aero.wakeReduction).toBe(0);
  });

  it('reports wakeReduction > 0 when follower is in the wake of a lead car', () => {
    const engine = makeEngine();
    settle(engine);
    // Lead car ahead at +Z, moving forward at +Z.
    engine.setLeadCarState({ x: 0, y: 0, z: 5 }, { x: 0, y: 0, z: 30 });
    // Our car is behind at z = -2.
    engine.worldPos.set(0, 1, -2);
    engine.velocityWS.set(0, 0, 20);
    engine.step(1 / 240);
    const snap = engine.snapshot();
    expect(snap.aero.wakeReduction).toBeGreaterThan(0);
    expect(snap.aero.wakeReduction).toBeLessThanOrEqual(0.25);
  });

  it('uses vehicle preset wake params when authored', () => {
    const vehicle = makeVehicle();
    vehicle.physics = {
      ...vehicle.physics,
      wakeLengthM: 10,
      wakeWidthM: 2,
      wakeReductionPct: 0.5,
    };
    const engine = new RacingEngine({ vehicle, track: makeTrack() });
    engines.push(engine);
    settle(engine);
    engine.setLeadCarState({ x: 0, y: 0, z: 5 }, { x: 0, y: 0, z: 30 });
    engine.worldPos.set(0, 1, -4);
    engine.velocityWS.set(0, 0, 20);
    engine.step(1 / 240);
    expect(engine.snapshot().aero.wakeReduction).toBeGreaterThan(0);
  });

  it('uses preset wheelInertiaKgM2 when authored', () => {
    const vehicle = makeVehicle();
    vehicle.physics = { ...vehicle.physics, wheelInertiaKgM2: 2.5 };
    const engine = new RacingEngine({ vehicle, track: makeTrack() });
    engines.push(engine);
    const internals = engine as unknown as { wheels: Array<{ inertia: number }> };
    expect(internals.wheels.every((w) => w.inertia === 2.5)).toBe(true);
  });

  it('exports a JSON-like telemetry object with lap, time, samples, and wheel channels', () => {
    const engine = makeEngine(makeTrack({ wetness: 0.2, condition: 'green-damp' }));
    settle(engine);
    forceSlidingState(engine);
    engine.step(1 / 240);

    const telemetry = engine.exportTelemetry();

    expect(telemetry.version).toBe(1);
    expect(telemetry.trackId).toBe('test-m8-track');
    expect(telemetry.vehicleId).toBe('test-rwd-m8');
    expect(telemetry.samples).toHaveLength(1);
    expect(telemetry.samples[0].lap).toEqual(telemetry.lap);
    expect(telemetry.samples[0].wheels).toHaveLength(4);
    expect(telemetry.channels.timeS).toHaveLength(1);
    expect(telemetry.channels.speedKmh).toHaveLength(1);
    expect(telemetry.channels.tireWearFL).toHaveLength(1);
    expect(telemetry.channels.flatSpotFL).toHaveLength(1);
    expect(Number.isFinite(telemetry.channels.tireWearFL[0])).toBe(true);
  });

  it('applies gyroscopic torque along chassis right axis, not fixed world-X', () => {
    const engine = makeEngine();
    settle(engine);

    // Yaw 90° so chassis right (the gyro torque axis) aligns with world Z.
    // In the buggy code the torque was always dumped onto world X.
    engine.worldQuat.setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);

    // High wheel speed for strong gyro signal.
    engine.velocityWS.set(-35, 0, 0);
    const internals = engine as unknown as {
      wheels: Array<{ omega: number }>;
      appliedTorque: { x: number; y: number; z: number };
      integrateChassis: (dt: number) => void;
    };
    for (const wheel of internals.wheels) wheel.omega = 120;

    press(engine, 'ArrowLeft');

    // Capture appliedTorque before integrateChassis clears it at the end of step().
    let captured: { x: number; y: number; z: number } | null = null;
    const orig = internals.integrateChassis;
    internals.integrateChassis = (dt: number) => {
      captured = { ...internals.appliedTorque };
      orig.call(internals, dt);
    };

    engine.step(1 / 240);

    expect(captured).not.toBeNull();
    // With the correct reference-frame fix the gyro contribution is projected
    // onto chassis right, which at 90° yaw is world Z, so |tz| should dominate
    // over |tx| (which is where the buggy code placed it).
    expect(Math.abs(captured!.z)).toBeGreaterThan(Math.abs(captured!.x));
  });

  it('steering at high speed produces non-zero chassis roll', () => {
    const engine = makeEngine();
    settle(engine);

    // Manually set high forward speed and wheel rotation.
    const speed = 35;
    engine.velocityWS.copy(
      (engine as unknown as { forward: Vector3 }).forward.clone()
    ).multiplyScalar(speed);
    const internals = engine as unknown as { wheels: Array<{ omega: number }> };
    for (const wheel of internals.wheels) wheel.omega = speed / 0.3;

    press(engine, 'ArrowLeft');
    const before = engine.snapshot().rollDeg;

    // Step long enough for tire cornering forces and gyro torque to integrate.
    for (let i = 0; i < 240; i++) engine.step(1 / 240);

    const after = engine.snapshot().rollDeg;
    expect(Math.abs(after - before)).toBeGreaterThan(0.001);
  });
});
