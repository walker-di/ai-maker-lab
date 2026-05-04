import { describe, expect, it } from 'bun:test';
import {
  clampSetup,
  defaultSetup,
  DEFAULT_SETUP,
  SURFACE_IDS,
  validateTrackPreset,
  validateVehiclePreset,
  type TrackPreset,
  type VehiclePreset,
} from './index.js';

const VALID_VEHICLE: VehiclePreset = {
  id: 'rwd-front-mid',
  label: 'RWD / Front-mid',
  driveLabel: 'RWD',
  layoutLabel: 'Front-mid',
  color: 0xffad66,
  wheelbase: 2.9,
  trackWidth: 1.7,
  frontMassPct: 0.49,
  finalDrive: 3.85,
  gears: [
    { n: 'R', ratio: -3.62 },
    { n: 'N', ratio: 0 },
    { n: '1', ratio: 3.5 },
    { n: '2', ratio: 2.3 },
  ],
  steerMaxDeg: 35,
  axleDrive: { front: 0, rear: 1 },
  diffType: 'welded',
};

const VALID_TRACK: TrackPreset = {
  id: 'classic-twist',
  label: 'Twisty Origin',
  groundColor: 0x33632e,
  halfWidth: 6,
  curbWidth: 0.6,
  rubberWidth: 2.6,
  marblesWidth: 1.3,
  samples: 240,
  ctrl: [
    [0, 60], [50, 50], [70, 10], [60, -30], [30, -60],
    [-10, -55], [-30, -25], [-55, 0], [-50, 35], [-25, 55],
  ],
};

describe('validateVehiclePreset', () => {
  it('accepts a fully populated preset', () => {
    expect(validateVehiclePreset(VALID_VEHICLE)).toEqual({ ok: true });
  });

  it('rejects when axleDrive shares do not sum to 1', () => {
    const result = validateVehiclePreset({
      ...VALID_VEHICLE,
      axleDrive: { front: 0.3, rear: 0.3 },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === 'axleDrive' && e.code === 'sum')).toBe(true);
    }
  });

  it('rejects unknown diff types', () => {
    const result = validateVehiclePreset({ ...VALID_VEHICLE, diffType: 'torsen' as never });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === 'diffType')).toBe(true);
    }
  });

  it('rejects invalid optional physics overrides', () => {
    const result = validateVehiclePreset({
      ...VALID_VEHICLE,
      physics: { massKg: 0, brakeBiasFront: 1.5 },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === 'physics.massKg')).toBe(true);
      expect(result.errors.some((e) => e.path === 'physics.brakeBiasFront')).toBe(true);
    }
  });

  it('rejects negative wheelbase', () => {
    const result = validateVehiclePreset({ ...VALID_VEHICLE, wheelbase: -1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === 'wheelbase')).toBe(true);
    }
  });
});

describe('validateTrackPreset', () => {
  it('accepts a fully populated preset', () => {
    expect(validateTrackPreset(VALID_TRACK)).toEqual({ ok: true });
  });

  it('rejects when control points are too few', () => {
    const result = validateTrackPreset({ ...VALID_TRACK, ctrl: [[0, 0], [1, 1]] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === 'ctrl')).toBe(true);
    }
  });

  it('rejects unknown surfaces in surfaceZones', () => {
    const result = validateTrackPreset({
      ...VALID_TRACK,
      surfaceZones: [{ x: 0, z: 0, w: 1, h: 1, rot: 0, surface: 'WET' as never }],
    });
    expect(result.ok).toBe(false);
  });
});

describe('clampSetup', () => {
  it('returns defaults when given null', () => {
    expect(clampSetup(null)).toEqual(defaultSetup());
  });

  it('clamps out-of-range values', () => {
    const out = clampSetup({
      frontToeDeg: 999,
      casterDeg: -5,
      ackermannPct: 5,
      motionRatioFront: 0,
      bumpStopGapFrontMm: 1000,
    });
    expect(out.frontToeDeg).toBeLessThanOrEqual(2);
    expect(out.casterDeg).toBeGreaterThanOrEqual(0);
    expect(out.ackermannPct).toBeLessThanOrEqual(1);
    expect(out.motionRatioFront).toBeGreaterThanOrEqual(0.4);
    expect(out.bumpStopGapFrontMm).toBeLessThanOrEqual(350);
  });

  it('fills missing fields from DEFAULT_SETUP', () => {
    const out = clampSetup({ frontToeDeg: 0.4 });
    expect(out.frontToeDeg).toBeCloseTo(0.4, 8);
    expect(out.casterDeg).toBe(DEFAULT_SETUP.casterDeg);
    expect(out.motionRatioRear).toBe(DEFAULT_SETUP.motionRatioRear);
  });
});

describe('SURFACE_IDS', () => {
  it('contains the seven named surfaces', () => {
    expect(SURFACE_IDS).toEqual(['RUBBER', 'ASPHALT', 'MARBLES', 'DAMP', 'CURB', 'GRASS', 'GRAVEL']);
  });
});
