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
  dimensions: {
    overallLengthM: 4.7,
    overallWidthM: 2.0,
    overallHeightM: 1.25,
    frontTrackWidthM: 1.71,
    rearTrackWidthM: 1.69,
  },
  tires: {
    frontSectionWidthM: 0.30,
    rearSectionWidthM: 0.31,
    frontOverallDiameterM: 0.68,
    rearOverallDiameterM: 0.71,
  },
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

  it('accepts valid optional load-transfer fields', () => {
    expect(
      validateVehiclePreset({
        ...VALID_VEHICLE,
        physics: {
          cgHeightM: 0.49,
          sprungCgHeightM: 0.52,
          unsprungCgHeightM: 0.31,
          unsprungMassFrontKg: 80,
          unsprungMassRearKg: 80,
        },
      }),
    ).toEqual({ ok: true });
  });

  it('rejects non-positive load-transfer fields', () => {
    const result = validateVehiclePreset({
      ...VALID_VEHICLE,
      physics: { sprungCgHeightM: 0, unsprungMassFrontKg: -10 },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === 'physics.sprungCgHeightM')).toBe(true);
      expect(result.errors.some((e) => e.path === 'physics.unsprungMassFrontKg')).toBe(true);
    }
  });

  it('rejects negative wheelbase', () => {
    const result = validateVehiclePreset({ ...VALID_VEHICLE, wheelbase: -1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === 'wheelbase')).toBe(true);
    }
  });

  it('rejects body widths narrower than track width', () => {
    const result = validateVehiclePreset({
      ...VALID_VEHICLE,
      dimensions: { overallWidthM: 1.6 },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === 'dimensions.overallWidthM')).toBe(true);
    }
  });

  it('rejects non-positive tyre geometry', () => {
    const result = validateVehiclePreset({
      ...VALID_VEHICLE,
      tires: { frontOverallDiameterM: 0, rearSectionWidthM: -0.1 },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === 'tires.frontOverallDiameterM')).toBe(true);
      expect(result.errors.some((e) => e.path === 'tires.rearSectionWidthM')).toBe(true);
    }
  });
});

describe('M3 suspension kinematics validation', () => {
  it('accepts a preset with valid damperFront/damperRear', () => {
    const result = validateVehiclePreset({
      ...VALID_VEHICLE,
      physics: {
        damperFront: { lsb: 4200, hsb: 2200, kneeB: 0.08, lsr: 5800, hsr: 3000, kneeR: 0.08 },
        damperRear: { lsb: 4400, hsb: 2400, kneeB: 0.08, lsr: 6000, hsr: 3200, kneeR: 0.08 },
      },
    });
    expect(result).toEqual({ ok: true });
  });

  it('rejects damperFront with non-positive field', () => {
    const result = validateVehiclePreset({
      ...VALID_VEHICLE,
      physics: {
        damperFront: { lsb: -100, hsb: 2200, kneeB: 0.08, lsr: 5800, hsr: 3000, kneeR: 0.08 },
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === 'physics.damperFront.lsb')).toBe(true);
    }
  });

  it('rejects damperRear with zero knee', () => {
    const result = validateVehiclePreset({
      ...VALID_VEHICLE,
      physics: {
        damperRear: { lsb: 4400, hsb: 2400, kneeB: 0, lsr: 6000, hsr: 3200, kneeR: 0.08 },
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === 'physics.damperRear.kneeB')).toBe(true);
    }
  });

  it('accepts valid kinematic tables', () => {
    const result = validateVehiclePreset({
      ...VALID_VEHICLE,
      physics: {
        bumpSteerFront: [[-0.05, -0.2], [0, 0], [0.10, 0.4]],
        bumpSteerRear: [[0, 0], [0.08, 0.3]],
        camberTableFront: [[0, 0], [0.10, -1.0]],
        rollCenterTableFront: [[0, 0.06], [0.10, 0.09]],
        bumpStopRateTableFront: [[0, 50000], [0.02, 150000]],
      },
    });
    expect(result).toEqual({ ok: true });
  });

  it('rejects a kinematic table with non-array entry', () => {
    const result = validateVehiclePreset({
      ...VALID_VEHICLE,
      physics: {
        bumpSteerFront: [[0, 0], 'bad' as unknown as [number, number]],
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.path.startsWith('physics.bumpSteerFront'))).toBe(true);
    }
  });

  it('rejects a kinematic table entry with wrong length', () => {
    const result = validateVehiclePreset({
      ...VALID_VEHICLE,
      physics: {
        camberTableRear: [[0, 0, 999] as unknown as [number, number]],
      },
    });
    expect(result.ok).toBe(false);
  });

  it('rejects a kinematic table that is not an array', () => {
    const result = validateVehiclePreset({
      ...VALID_VEHICLE,
      physics: {
        rollCenterTableFront: 'invalid' as unknown as ReadonlyArray<readonly [number, number]>,
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === 'physics.rollCenterTableFront')).toBe(true);
    }
  });

  it('accepts a preset with all optional M3 tables omitted (backward compat)', () => {
    expect(validateVehiclePreset(VALID_VEHICLE)).toEqual({ ok: true });
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

describe('Chassis compliance validation', () => {
  it('accepts a preset with valid compliance fields', () => {
    const result = validateVehiclePreset({
      ...VALID_VEHICLE,
      physics: {
        compliance: {
          hubLinearStiffnessNpm: 150000,
          hubLinearDampingNspms: 2.5,
          hubRotationalStiffnessNmDeg: 8,
          hubRotationalDampingNmSdeg: 0.4,
          chassisTorsionalStiffnessNmDeg: 22000,
        },
      },
    });
    expect(result).toEqual({ ok: true });
  });

  it('rejects negative compliance stiffness', () => {
    const result = validateVehiclePreset({
      ...VALID_VEHICLE,
      physics: { compliance: { hubLinearStiffnessNpm: -1 } },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === 'physics.compliance.hubLinearStiffnessNpm')).toBe(true);
    }
  });

  it('rejects compliance hubLinearStiffnessNpm above 500000', () => {
    const result = validateVehiclePreset({
      ...VALID_VEHICLE,
      physics: { compliance: { hubLinearStiffnessNpm: 600000 } },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === 'physics.compliance.hubLinearStiffnessNpm')).toBe(true);
    }
  });

  it('rejects compliance hubRotationalStiffnessNmDeg above 10000', () => {
    const result = validateVehiclePreset({
      ...VALID_VEHICLE,
      physics: { compliance: { hubRotationalStiffnessNmDeg: 15000 } },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === 'physics.compliance.hubRotationalStiffnessNmDeg')).toBe(true);
    }
  });

  it('rejects compliance chassisTorsionalStiffnessNmDeg above 100000', () => {
    const result = validateVehiclePreset({
      ...VALID_VEHICLE,
      physics: { compliance: { chassisTorsionalStiffnessNmDeg: 120000 } },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === 'physics.compliance.chassisTorsionalStiffnessNmDeg')).toBe(true);
    }
  });

  it('accepts compliance with all fields omitted (backward compat)', () => {
    expect(validateVehiclePreset(VALID_VEHICLE)).toEqual({ ok: true });
  });
});

describe('SURFACE_IDS', () => {
  it('contains the seven named surfaces', () => {
    expect(SURFACE_IDS).toEqual(['RUBBER', 'ASPHALT', 'MARBLES', 'DAMP', 'CURB', 'GRASS', 'GRAVEL']);
  });
});

describe('M4 validateTrackPreset — elevation/kerb/condition fields', () => {
  it('accepts a valid track with elevationSamples', () => {
    const result = validateTrackPreset({
      ...VALID_TRACK,
      elevationSamples: [
        { segmentIndex: 0, y: 0 },
        { segmentIndex: 32, y: 5 },
      ],
    });
    expect(result.ok).toBe(true);
  });

  it('rejects elevationSamples with a negative segmentIndex', () => {
    const result = validateTrackPreset({
      ...VALID_TRACK,
      elevationSamples: [{ segmentIndex: -1, y: 0 }],
    });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; errors: { path: string }[] }).errors.some(
      e => e.path.includes('elevationSamples'),
    )).toBe(true);
  });

  it('rejects elevationSamples with a non-finite y', () => {
    const result = validateTrackPreset({
      ...VALID_TRACK,
      elevationSamples: [{ segmentIndex: 0, y: NaN }],
    });
    expect(result.ok).toBe(false);
  });

  it('accepts a valid kerbProfile', () => {
    const result = validateTrackPreset({
      ...VALID_TRACK,
      kerbProfile: { widthM: 0.5, crownHeightM: 0.04, topFlatFraction: 0, bumpForceN: 800 },
    });
    expect(result.ok).toBe(true);
  });

  it('rejects kerbProfile with widthM <= 0', () => {
    const result = validateTrackPreset({
      ...VALID_TRACK,
      kerbProfile: { widthM: -0.1, crownHeightM: 0.04, topFlatFraction: 0, bumpForceN: 800 },
    });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; errors: { path: string }[] }).errors.some(
      e => e.path === 'kerbProfile.widthM',
    )).toBe(true);
  });

  it('rejects kerbProfile with topFlatFraction outside [0, 1]', () => {
    const result = validateTrackPreset({
      ...VALID_TRACK,
      kerbProfile: { widthM: 0.5, crownHeightM: 0.04, topFlatFraction: 1.5, bumpForceN: 800 },
    });
    expect(result.ok).toBe(false);
  });

  it('rejects kerbProfile with negative bumpForceN', () => {
    const result = validateTrackPreset({
      ...VALID_TRACK,
      kerbProfile: { widthM: 0.5, crownHeightM: 0.04, topFlatFraction: 0, bumpForceN: -10 },
    });
    expect(result.ok).toBe(false);
  });

  it('accepts valid bumpAmplitudeM / trackTempC / rubberLineGrip', () => {
    const result = validateTrackPreset({
      ...VALID_TRACK,
      bumpAmplitudeM: 0.005,
      trackTempC: 32,
      rubberLineGrip: 1.08,
    });
    expect(result.ok).toBe(true);
  });

  it('rejects bumpAmplitudeM < 0', () => {
    const result = validateTrackPreset({ ...VALID_TRACK, bumpAmplitudeM: -1 });
    expect(result.ok).toBe(false);
  });

  it('rejects rubberLineGrip <= 0', () => {
    const result = validateTrackPreset({ ...VALID_TRACK, rubberLineGrip: 0 });
    expect(result.ok).toBe(false);
  });

  it('rejects non-finite trackTempC', () => {
    const result = validateTrackPreset({ ...VALID_TRACK, trackTempC: Infinity });
    expect(result.ok).toBe(false);
  });

  it('valid track without any M4 fields still passes', () => {
    expect(validateTrackPreset(VALID_TRACK)).toEqual({ ok: true });
  });
});

// ---------------------------------------------------------------------------
// M5 aero map validation
// ---------------------------------------------------------------------------

describe('validateVehiclePreset — M5 aeroMap', () => {
  const VALID_MAP = {
    frontClAreaMap: {
      axis0: [0.05, 0.15],
      axis1: [-2, 0, 2],
      data: [[1.5, 1.6, 1.4], [0.8, 1.0, 0.9]],
    },
    rearClAreaMap: {
      axis0: [0.05, 0.15],
      axis1: [-2, 0, 2],
      data: [[2.0, 2.2, 2.1], [1.4, 1.5, 1.45]],
    },
    yawDragMap: {
      axis0: [0, 10, 20],
      axis1: [0, 200],
      data: [[0, 0], [0.1, 0.15], [0.3, 0.4]],
    },
    copFraction: 0.55,
    stallRideHeightM: 0.04,
  };

  it('accepts a valid aeroMap', () => {
    const result = validateVehiclePreset({
      ...VALID_VEHICLE,
      physics: { aeroMap: VALID_MAP },
    });
    expect(result.ok).toBe(true);
  });

  it('accepts aeroMap with only some sub-tables (additive / optional)', () => {
    const result = validateVehiclePreset({
      ...VALID_VEHICLE,
      physics: { aeroMap: { frontClAreaMap: VALID_MAP.frontClAreaMap } },
    });
    expect(result.ok).toBe(true);
  });

  it('accepts a vehicle with no aeroMap (scalar fallback)', () => {
    expect(validateVehiclePreset(VALID_VEHICLE)).toEqual({ ok: true });
  });

  it('rejects aeroMap that is not an object', () => {
    const result = validateVehiclePreset({
      ...VALID_VEHICLE,
      physics: { aeroMap: 'bad' as unknown as object },
    });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; errors: { path: string }[] }).errors.some(
      e => e.path === 'physics.aeroMap',
    )).toBe(true);
  });

  it('rejects frontClAreaMap with non-finite axis0 values', () => {
    const result = validateVehiclePreset({
      ...VALID_VEHICLE,
      physics: {
        aeroMap: {
          frontClAreaMap: { axis0: [NaN, 0.15], axis1: [0], data: [[1], [1]] },
        },
      },
    });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; errors: { path: string }[] }).errors.some(
      e => e.path.includes('axis0'),
    )).toBe(true);
  });

  it('rejects data row with non-finite values', () => {
    const result = validateVehiclePreset({
      ...VALID_VEHICLE,
      physics: {
        aeroMap: {
          rearClAreaMap: { axis0: [0.1], axis1: [0], data: [[Infinity]] },
        },
      },
    });
    expect(result.ok).toBe(false);
  });

  it('rejects copFraction outside [0, 1]', () => {
    const result = validateVehiclePreset({
      ...VALID_VEHICLE,
      physics: { aeroMap: { copFraction: 1.5 } },
    });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; errors: { path: string }[] }).errors.some(
      e => e.path === 'physics.aeroMap.copFraction',
    )).toBe(true);
  });

  it('rejects negative copFraction', () => {
    const result = validateVehiclePreset({
      ...VALID_VEHICLE,
      physics: { aeroMap: { copFraction: -0.1 } },
    });
    expect(result.ok).toBe(false);
  });

  it('rejects negative stallRideHeightM', () => {
    const result = validateVehiclePreset({
      ...VALID_VEHICLE,
      physics: { aeroMap: { stallRideHeightM: -0.01 } },
    });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; errors: { path: string }[] }).errors.some(
      e => e.path === 'physics.aeroMap.stallRideHeightM',
    )).toBe(true);
  });

  it('accepts stallRideHeightM of 0', () => {
    const result = validateVehiclePreset({
      ...VALID_VEHICLE,
      physics: { aeroMap: { stallRideHeightM: 0 } },
    });
    expect(result.ok).toBe(true);
  });

  it('rejects yawDragMap data row with non-array entries', () => {
    const result = validateVehiclePreset({
      ...VALID_VEHICLE,
      physics: {
        aeroMap: {
          yawDragMap: {
            axis0: [0, 10],
            axis1: [0, 200],
            data: [[0, 0], 'bad' as unknown as number[]],
          },
        },
      },
    });
    expect(result.ok).toBe(false);
  });
});
