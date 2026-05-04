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
  engine.velocityWS.set(0, 0, input.speedMs);
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
  engine.velocityWS.set(lateralMs, 0, input.speedMs);
  internals.prevLocalVelocity.set(lateralMs, 0, input.speedMs);
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
    engine.velocityWS.set(0, 0, 22);
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
    engine.velocityWS.set(0, 0, 18);
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

    const torques = escTorqueByWheel(engine, {
      speedKmh: 90,
      speedMs: 25,
      steerSmoothed: 0.7,
      yawRateRad: 2.5,
      sideslipDeg: 12,
    });

    expect(torques).toEqual([2400, 0, 0, 0]);
    expect(engine.snapshot().aids.escActive).toBe(true);
  });

  it('ESC understeer intervention targets the inside rear wheel and clears when disabled', () => {
    const engine = createEngine();
    engine.setEscEnabled(true);

    const torques = escTorqueByWheel(engine, {
      speedKmh: 90,
      speedMs: 25,
      steerSmoothed: 0.7,
      yawRateRad: 0.1,
      sideslipDeg: 4,
    });

    expect(torques).toEqual([0, 0, 0, 1920]);

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

  it('reports roll and pitch from the chassis orientation', () => {
    const engine = createEngine();
    engine.worldQuat.copy(new Quaternion().setFromEuler(new Euler(4 * (Math.PI / 180), 0, 6 * (Math.PI / 180), 'XYZ')));
    engine.velocityWS.set(0, 0, 10);
    engine.step(1 / 240);

    const snapshot = engine.snapshot();
    expect(Math.abs(snapshot.rollDeg)).toBeGreaterThan(1);
    expect(Math.abs(snapshot.pitchDeg)).toBeGreaterThan(1);
  });

  it('honors explicit authored surface zones', () => {
    const track: TrackPreset = {
      ...makeTrack(),
      surfaceZones: [{ x: 0, z: 0, w: 40, h: 40, rot: 0, surface: 'GRAVEL' }],
    };
    const engine = new RacingEngine({ vehicle: makeVehicle(), track });
    engines.push(engine);
    engine.resetCar();

    stepFor(engine, 0.1);

    const snapshot = engine.snapshot();
    expect(snapshot.wheels.some((wheel) => wheel.surface === 'GRAVEL')).toBe(true);
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
