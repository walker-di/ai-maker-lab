/**
 * M3 — suspension-kinematics unit tests.
 *
 * Covers: interpolation, bump-steer, camber/caster vs travel,
 * roll-center lookup, jacking force, progressive bump-stop, and the
 * combined `resolveWheelKinematics` entry point.
 */
import { describe, test, expect } from 'bun:test';
import {
  interpolateKinematic,
  computeBumpSteerToe,
  computeCamberVsTravel,
  computeCasterVsTravel,
  computeRollCenterHeight,
  computeJackingForce,
  computeProgressiveBumpStop,
  resolveWheelKinematics,
  DEFAULT_ROLL_CENTER_HEIGHT_M,
  type KinematicTable,
} from './suspension-kinematics.js';

// ---------------------------------------------------------------------------
// interpolateKinematic
// ---------------------------------------------------------------------------
describe('interpolateKinematic', () => {
  const table: KinematicTable = [
    [-0.05, -1],
    [0, 0],
    [0.05, 1],
    [0.10, 1.5],
  ];

  test('returns the exact value at a table point', () => {
    expect(interpolateKinematic(table, 0)).toBe(0);
    expect(interpolateKinematic(table, 0.05)).toBe(1);
  });

  test('interpolates between two points', () => {
    expect(interpolateKinematic(table, 0.025)).toBeCloseTo(0.5, 5);
  });

  test('extrapolates below the first entry', () => {
    // slope from [-0.05,-1] to [0,0] is 20 deg/m
    const v = interpolateKinematic(table, -0.10);
    expect(v).toBeCloseTo(-2, 5);
  });

  test('extrapolates above the last entry', () => {
    // slope from [0.05,1] to [0.10,1.5] is 10 deg/m
    const v = interpolateKinematic(table, 0.15);
    expect(v).toBeCloseTo(2, 5);
  });

  test('single-entry table returns constant', () => {
    expect(interpolateKinematic([[0.02, 3.5]], 0.10)).toBe(3.5);
  });

  test('empty table returns 0', () => {
    expect(interpolateKinematic([], 0.10)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeBumpSteerToe
// ---------------------------------------------------------------------------
describe('computeBumpSteerToe', () => {
  const bumpTable: KinematicTable = [
    [0, 0],
    [0.10, 0.5], // 0.5° toe-in at full compression
  ];

  test('returns static toe when no table is provided', () => {
    expect(
      computeBumpSteerToe({ staticToeDeg: 0.2, travel: 0.05, bumpSteerTable: undefined, lateralSign: 1 }),
    ).toBe(0.2);
  });

  test('adds bump-steer delta to static toe', () => {
    const result = computeBumpSteerToe({
      staticToeDeg: 0,
      travel: 0.10,
      bumpSteerTable: bumpTable,
      lateralSign: 1,
    });
    expect(result).toBeCloseTo(0.5, 5);
  });

  test('mirrors delta across chassis sides (lateralSign)', () => {
    const left = computeBumpSteerToe({ staticToeDeg: 0, travel: 0.10, bumpSteerTable: bumpTable, lateralSign: -1 });
    const right = computeBumpSteerToe({ staticToeDeg: 0, travel: 0.10, bumpSteerTable: bumpTable, lateralSign: 1 });
    expect(left).toBeCloseTo(-0.5, 5);
    expect(right).toBeCloseTo(0.5, 5);
  });

  test('zero travel returns zero bump-steer delta', () => {
    const result = computeBumpSteerToe({ staticToeDeg: 0.1, travel: 0, bumpSteerTable: bumpTable, lateralSign: 1 });
    expect(result).toBeCloseTo(0.1, 5);
  });
});

// ---------------------------------------------------------------------------
// computeCamberVsTravel
// ---------------------------------------------------------------------------
describe('computeCamberVsTravel', () => {
  const camberTable: KinematicTable = [
    [0, 0],
    [0.10, -1.0], // gains 1° negative camber under full compression
  ];

  test('returns static camber when no table', () => {
    expect(computeCamberVsTravel({ staticCamberDeg: -2, travel: 0.05, camberTable: undefined })).toBe(-2);
  });

  test('adds camber delta at max travel', () => {
    const result = computeCamberVsTravel({ staticCamberDeg: -1.5, travel: 0.10, camberTable });
    expect(result).toBeCloseTo(-2.5, 5);
  });

  test('zero travel produces zero delta', () => {
    const result = computeCamberVsTravel({ staticCamberDeg: -1.5, travel: 0, camberTable });
    expect(result).toBeCloseTo(-1.5, 5);
  });
});

// ---------------------------------------------------------------------------
// computeCasterVsTravel
// ---------------------------------------------------------------------------
describe('computeCasterVsTravel', () => {
  const casterTable: KinematicTable = [
    [-0.05, -0.3],
    [0, 0],
    [0.10, 0.5],
  ];

  test('returns static caster when no table', () => {
    expect(computeCasterVsTravel({ staticCasterDeg: 4, travel: 0.05, casterTable: undefined })).toBe(4);
  });

  test('adds caster delta at compression', () => {
    const result = computeCasterVsTravel({ staticCasterDeg: 4, travel: 0.10, casterTable });
    expect(result).toBeCloseTo(4.5, 5);
  });

  test('adds negative delta at droop', () => {
    const result = computeCasterVsTravel({ staticCasterDeg: 4, travel: -0.05, casterTable });
    expect(result).toBeCloseTo(3.7, 5);
  });
});

// ---------------------------------------------------------------------------
// computeRollCenterHeight
// ---------------------------------------------------------------------------
describe('computeRollCenterHeight', () => {
  test('returns DEFAULT_ROLL_CENTER_HEIGHT_M when no table', () => {
    expect(computeRollCenterHeight({ rollCenterTable: undefined, travel: 0.05 })).toBe(
      DEFAULT_ROLL_CENTER_HEIGHT_M,
    );
  });

  test('interpolates from table', () => {
    const table: KinematicTable = [
      [0, 0.05],
      [0.10, 0.08],
    ];
    const h = computeRollCenterHeight({ rollCenterTable: table, travel: 0.05 });
    expect(h).toBeCloseTo(0.065, 5);
  });
});

// ---------------------------------------------------------------------------
// computeJackingForce
// ---------------------------------------------------------------------------
describe('computeJackingForce', () => {
  test('zero Fy produces zero jacking force', () => {
    expect(computeJackingForce({ fy: 0, rollCenterHeightM: 0.07, trackHalfM: 0.75 })).toBe(0);
  });

  test('positive Fy and positive roll-center produce positive jacking force', () => {
    const f = computeJackingForce({ fy: 5000, rollCenterHeightM: 0.07, trackHalfM: 0.75 });
    expect(f).toBeGreaterThan(0);
  });

  test('scales linearly with Fy', () => {
    const f1 = computeJackingForce({ fy: 1000, rollCenterHeightM: 0.07, trackHalfM: 0.75 });
    const f2 = computeJackingForce({ fy: 2000, rollCenterHeightM: 0.07, trackHalfM: 0.75 });
    expect(f2).toBeCloseTo(f1 * 2, 5);
  });

  test('scales linearly with roll-center height', () => {
    const f1 = computeJackingForce({ fy: 5000, rollCenterHeightM: 0.05, trackHalfM: 0.75 });
    const f2 = computeJackingForce({ fy: 5000, rollCenterHeightM: 0.10, trackHalfM: 0.75 });
    expect(f2).toBeCloseTo(f1 * 2, 5);
  });

  test('formula: fy * rcHeight / trackHalf', () => {
    const fy = 4000, rc = 0.07, half = 0.75;
    expect(computeJackingForce({ fy, rollCenterHeightM: rc, trackHalfM: half })).toBeCloseTo(
      fy * rc / half,
      4,
    );
  });
});

// ---------------------------------------------------------------------------
// computeProgressiveBumpStop
// ---------------------------------------------------------------------------
describe('computeProgressiveBumpStop', () => {
  test('returns 0 below threshold', () => {
    expect(computeProgressiveBumpStop({ compression: 0.10, threshold: 0.22, baseRateNpm: 50000, rateTable: undefined })).toBe(0);
  });

  test('returns 0 when baseRateNpm is 0', () => {
    expect(computeProgressiveBumpStop({ compression: 0.30, threshold: 0.22, baseRateNpm: 0, rateTable: undefined })).toBe(0);
  });

  test('without table matches legacy elastomer formula', () => {
    const compression = 0.25;
    const threshold = 0.22;
    const bumpK = 50000;
    const over = compression - threshold;
    const expected = bumpK * over * (1 + over / 0.03);
    const result = computeProgressiveBumpStop({ compression, threshold, baseRateNpm: bumpK, rateTable: undefined });
    expect(result).toBeCloseTo(expected, 3);
  });

  test('with authored table uses interpolated rate', () => {
    const rateTable: KinematicTable = [
      [0, 50000],
      [0.02, 120000],
    ];
    const compression = 0.23; // 0.01 m past threshold of 0.22
    const result = computeProgressiveBumpStop({ compression, threshold: 0.22, baseRateNpm: 50000, rateTable });
    // rate at 0.01 over = interpolate(0.01) = 85000
    const expectedRate = 50000 + (120000 - 50000) * (0.01 / 0.02);
    expect(result).toBeCloseTo(expectedRate * 0.01, 1);
  });

  test('progressive: force increases with compression', () => {
    const f1 = computeProgressiveBumpStop({ compression: 0.23, threshold: 0.22, baseRateNpm: 50000, rateTable: undefined });
    const f2 = computeProgressiveBumpStop({ compression: 0.25, threshold: 0.22, baseRateNpm: 50000, rateTable: undefined });
    expect(f2).toBeGreaterThan(f1);
  });
});

// ---------------------------------------------------------------------------
// resolveWheelKinematics
// ---------------------------------------------------------------------------
describe('resolveWheelKinematics', () => {
  test('all defaults (no tables) returns static values', () => {
    const result = resolveWheelKinematics({
      staticToeDeg: 0.1,
      staticCamberDeg: -1.5,
      staticCasterDeg: 4,
      travel: 0.05,
      lateralSign: 1,
      bumpSteerTable: undefined,
      camberTable: undefined,
      casterTable: undefined,
      rollCenterTable: undefined,
    });
    expect(result.toeDeg).toBe(0.1);
    expect(result.camberDeg).toBe(-1.5);
    expect(result.casterDeg).toBe(4);
    expect(result.rollCenterHeightM).toBe(DEFAULT_ROLL_CENTER_HEIGHT_M);
  });

  test('bump-steer toe changes under compression', () => {
    const bumpSteerTable: KinematicTable = [[0, 0], [0.10, 0.5]];
    const resultAt0 = resolveWheelKinematics({
      staticToeDeg: 0,
      staticCamberDeg: -1.5,
      staticCasterDeg: 4,
      travel: 0,
      lateralSign: 1,
      bumpSteerTable,
      camberTable: undefined,
      casterTable: undefined,
      rollCenterTable: undefined,
    });
    const resultAt10 = resolveWheelKinematics({
      staticToeDeg: 0,
      staticCamberDeg: -1.5,
      staticCasterDeg: 4,
      travel: 0.10,
      lateralSign: 1,
      bumpSteerTable,
      camberTable: undefined,
      casterTable: undefined,
      rollCenterTable: undefined,
    });
    expect(resultAt0.toeDeg).toBeCloseTo(0, 5);
    expect(resultAt10.toeDeg).toBeCloseTo(0.5, 5);
  });

  test('camber changes with travel when table is present', () => {
    const camberTable: KinematicTable = [[0, 0], [0.10, -1.0]];
    const result = resolveWheelKinematics({
      staticToeDeg: 0,
      staticCamberDeg: -1.5,
      staticCasterDeg: 4,
      travel: 0.10,
      lateralSign: 1,
      bumpSteerTable: undefined,
      camberTable,
      casterTable: undefined,
      rollCenterTable: undefined,
    });
    expect(result.camberDeg).toBeCloseTo(-2.5, 5);
  });

  test('roll-center height is read from table', () => {
    const rcTable: KinematicTable = [[0, 0.06], [0.10, 0.09]];
    const result = resolveWheelKinematics({
      staticToeDeg: 0,
      staticCamberDeg: -1.5,
      staticCasterDeg: 4,
      travel: 0.10,
      lateralSign: 1,
      bumpSteerTable: undefined,
      camberTable: undefined,
      casterTable: undefined,
      rollCenterTable: rcTable,
    });
    expect(result.rollCenterHeightM).toBeCloseTo(0.09, 5);
  });
});
