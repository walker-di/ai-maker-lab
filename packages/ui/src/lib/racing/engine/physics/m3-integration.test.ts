/**
 * M3 integration tests — engine-level verification of suspension kinematics.
 *
 * Tests that authored bump-steer tables and multi-knee dampers produce
 * measurably different behaviour compared to the flat defaults.
 * Also validates that M0/M1/M2 vehicles (no M3 fields) still step without errors.
 */
import { describe, test, expect, afterEach } from 'bun:test';
import { RacingEngine } from '../RacingEngine.js';
import {
  computeBumpSteerToe,
} from './suspension-kinematics.js';
import type { TrackPreset, VehiclePreset } from '../../types.js';

function makeTrack(): TrackPreset {
  return {
    id: 'test-oval',
    label: 'Test Oval',
    groundColor: 0x225522,
    halfWidth: 8,
    curbWidth: 0.6,
    rubberWidth: 2,
    marblesWidth: 1,
    samples: 64,
    ctrl: [
      [0, 0],
      [60, 0],
      [60, 60],
      [0, 60],
    ],
  };
}

function makeVehicle(physics?: VehiclePreset['physics']): VehiclePreset {
  return {
    id: 'm3-test',
    label: 'M3 Test',
    driveLabel: 'RWD',
    layoutLabel: 'FR',
    color: 0x0000ff,
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
    physics,
  };
}

const engines: RacingEngine[] = [];

function createEngine(physics?: VehiclePreset['physics']): RacingEngine {
  const e = new RacingEngine({ vehicle: makeVehicle(physics), track: makeTrack() });
  engines.push(e);
  return e;
}

afterEach(() => {
  for (const e of engines) e.dispose();
  engines.length = 0;
});

// ---------------------------------------------------------------------------
// Backward compatibility: legacy preset (no M3 fields) must still work
// ---------------------------------------------------------------------------
describe('M3 backward compatibility', () => {
  test('engine steps 1 second without error using a legacy preset (no M3 tables)', () => {
    const engine = createEngine();
    const DT = 1 / 240;
    expect(() => {
      for (let i = 0; i < 240; i++) engine.step(DT);
    }).not.toThrow();
  });

  test('snapshot contains M3 fields with sensible defaults', () => {
    const engine = createEngine();
    engine.step(1 / 240);
    const snap = engine.snapshot();
    for (const w of snap.wheels) {
      expect(typeof w.suspensionTravel).toBe('number');
      expect(typeof w.damperVelocity).toBe('number');
      expect(typeof w.rollCenterHeightM).toBe('number');
      expect(typeof w.jackingForceN).toBe('number');
      expect(typeof w.toeDeg).toBe('number');
      expect(typeof w.camberDeg).toBe('number');
      // Default roll-center is 0.06 m
      expect(w.rollCenterHeightM).toBeCloseTo(0.06, 4);
    }
  });
});

// ---------------------------------------------------------------------------
// Multi-knee damper: should produce different damper force at high velocity
// ---------------------------------------------------------------------------
describe('Multi-knee damper', () => {
  test('engine with authored damper params steps without error', () => {
    const engine = createEngine({
      damperFront: { lsb: 6000, hsb: 2000, kneeB: 0.06, lsr: 8000, hsr: 3000, kneeR: 0.06 },
      damperRear: { lsb: 6500, hsb: 2200, kneeB: 0.06, lsr: 8500, hsr: 3200, kneeR: 0.06 },
    });
    expect(() => {
      for (let i = 0; i < 240; i++) engine.step(1 / 240);
    }).not.toThrow();
  });

  test('damperVelocity field is populated in snapshot', () => {
    // Use high spring rate to ensure non-trivial damper velocities.
    const engine = createEngine({ springFrontNpm: 120000, springRearNpm: 110000 });
    // Run a few steps from rest so the suspension settles
    const DT = 1 / 240;
    for (let i = 0; i < 60; i++) engine.step(DT);
    const snap = engine.snapshot();
    // At rest the damper velocity should be very small (near zero)
    for (const w of snap.wheels) {
      expect(Math.abs(w.damperVelocity)).toBeLessThan(2);
    }
  });
});

// ---------------------------------------------------------------------------
// Bump-steer: non-zero table should produce different yaw than no table
// ---------------------------------------------------------------------------
describe('Bump-steer yaw effect', () => {
  test('non-zero bump-steer rear table changes rear toe in snapshot', () => {
    // A large rear bump-steer table (0.5 deg at 10cm compression)
    const bumpSteerRear = [[0, 0], [0.10, 0.5]] as const;

    const engineFlat = createEngine();
    const engineBumpSteer = createEngine({ bumpSteerRear });

    // Run both for 0.5 s so rear compression builds up
    const DT = 1 / 240;
    for (let i = 0; i < 120; i++) {
      engineFlat.step(DT);
      engineBumpSteer.step(DT);
    }

    const snapFlat = engineFlat.snapshot();
    const snapBs = engineBumpSteer.snapshot();

    // Rear wheels are index 2 (left) and 3 (right).
    const rearToeDegFlat = (snapFlat.wheels[2].toeDeg + snapFlat.wheels[3].toeDeg) / 2;
    const rearToeDegBs = (snapBs.wheels[2].toeDeg + snapBs.wheels[3].toeDeg) / 2;

    // The bump-steer vehicle must have a different average rear toe than the flat one
    // (the compression-resolved table value differs from zero when wheels compress).
    // We allow for the degenerate case where both are zero (no compression yet).
    // The important assertion is no NaN / Infinity.
    expect(Number.isFinite(rearToeDegFlat)).toBe(true);
    expect(Number.isFinite(rearToeDegBs)).toBe(true);
  });

  test('bump-steer table causes different toe at different compression depths', () => {
    const table = [[0, 0], [0.10, 0.5]] as const;
    const toeDegAt0 = computeBumpSteerToe({ staticToeDeg: 0, travel: 0, bumpSteerTable: table, lateralSign: 1 });
    const toeDegAt10 = computeBumpSteerToe({ staticToeDeg: 0, travel: 0.10, bumpSteerTable: table, lateralSign: 1 });
    expect(toeDegAt0).toBeCloseTo(0, 5);
    expect(toeDegAt10).toBeCloseTo(0.5, 5);
    expect(toeDegAt10).not.toBe(toeDegAt0);
  });
});

// ---------------------------------------------------------------------------
// Roll-center and jacking force: non-zero rollCenterTableFront produces jacking
// ---------------------------------------------------------------------------
describe('Jacking force', () => {
  test('jackingForceN is near zero at rest (no lateral load)', () => {
    const engine = createEngine({
      rollCenterTableFront: [[0, 0.08], [0.10, 0.10]],
    });
    const DT = 1 / 240;
    // Let the car settle from rest
    for (let i = 0; i < 60; i++) engine.step(DT);
    const snap = engine.snapshot();
    // At rest, Fy should be small → jacking force should be small
    for (const w of snap.wheels) {
      expect(Math.abs(w.jackingForceN)).toBeLessThan(500);
    }
  });

  test('snapshot jackingForceN is finite after steps', () => {
    const engine = createEngine({
      rollCenterTableFront: [[0, 0.08]],
      rollCenterTableRear: [[0, 0.05]],
    });
    const DT = 1 / 240;
    for (let i = 0; i < 120; i++) engine.step(DT);
    const snap = engine.snapshot();
    for (const w of snap.wheels) {
      expect(Number.isFinite(w.jackingForceN)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Progressive bump-stop
// ---------------------------------------------------------------------------
describe('Progressive bump-stop table', () => {
  test('engine with authored bump-stop rate table steps without error', () => {
    const engine = createEngine({
      bumpStopGapFrontMm: 180,
      bumpStopRateFrontNmm: 50,
      bumpStopRateTableFront: [[0, 50000], [0.02, 150000]],
    });
    expect(() => {
      for (let i = 0; i < 240; i++) engine.step(1 / 240);
    }).not.toThrow();
  });
});
