/**
 * M6 Drivetrain Depth — domain validation tests.
 *
 * Covers optional fields added in M6:
 *   physics.turbo, physics.engineTorqueMap, physics.engineTorqueCurve,
 *   physics.shiftLogic, physics.drivelineCompliance, physics.engineBraking
 *
 * All fields are additive; existing NA presets must continue to validate
 * without errors (backward-compat).
 */
import { describe, expect, it } from 'bun:test';
import { validateVehiclePreset } from './validation.js';

// ------------------------------------------------------------------ helpers

const VALID_BASE = {
  id: 'turbo-sports',
  label: 'Turbo Sports',
  driveLabel: 'RWD' as const,
  layoutLabel: 'FR',
  color: 0xcc2200,
  wheelbase: 2.55,
  trackWidth: 1.78,
  frontMassPct: 0.47,
  finalDrive: 3.7,
  steerMaxDeg: 28,
  gears: [
    { n: 'R', ratio: -3.5 },
    { n: 'N', ratio: 0 },
    { n: '1', ratio: 3.2 },
    { n: '2', ratio: 2.1 },
    { n: '3', ratio: 1.5 },
  ],
  axleDrive: { front: 0, rear: 1 },
  diffType: 'clutchLSD' as const,
};

// ------------------------------------------------------------------ turbo

describe('M6 validateVehiclePreset — turbo', () => {
  it('accepts a preset with no turbo (NA default)', () => {
    expect(validateVehiclePreset(VALID_BASE)).toMatchObject({ ok: true });
  });

  it('accepts a complete turbo config', () => {
    const result = validateVehiclePreset({
      ...VALID_BASE,
      physics: {
        turbo: {
          peakBoostBar: 1.4,
          overboostLimitBar: 1.6,
          peakTorqueMultiplier: 1.5,
          targetSpoolRpm: 3200,
          spoolUpTimeS: 1.5,
          spoolDownTimeS: 2.0,
          idleSpoolRatio: 0.05,
          efficiencyScale: 0.95,
        },
      },
    });
    expect(result).toMatchObject({ ok: true });
  });

  it('rejects turbo.peakBoostBar = 0', () => {
    const r = validateVehiclePreset({
      ...VALID_BASE,
      physics: { turbo: { peakBoostBar: 0 } },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some(e => e.path === 'physics.turbo.peakBoostBar')).toBe(true);
    }
  });

  it('rejects turbo.peakBoostBar < 0', () => {
    const r = validateVehiclePreset({
      ...VALID_BASE,
      physics: { turbo: { peakBoostBar: -0.1 } },
    });
    expect(r.ok).toBe(false);
  });

  it('rejects turbo.spoolUpTimeS = 0', () => {
    const r = validateVehiclePreset({
      ...VALID_BASE,
      physics: { turbo: { spoolUpTimeS: 0 } },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some(e => e.path === 'physics.turbo.spoolUpTimeS')).toBe(true);
    }
  });

  it('rejects turbo.idleSpoolRatio < 0', () => {
    const r = validateVehiclePreset({
      ...VALID_BASE,
      physics: { turbo: { idleSpoolRatio: -0.01 } },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some(e => e.path === 'physics.turbo.idleSpoolRatio')).toBe(true);
    }
  });

  it('rejects turbo.efficiencyScale < 0', () => {
    const r = validateVehiclePreset({
      ...VALID_BASE,
      physics: { turbo: { efficiencyScale: -1 } },
    });
    expect(r.ok).toBe(false);
  });

  it('rejects turbo as a non-object', () => {
    const r = validateVehiclePreset({
      ...VALID_BASE,
      physics: { turbo: 'bad' as unknown as Record<string, unknown> },
    });
    expect(r.ok).toBe(false);
  });
});

// ------------------------------------------------------------------ engineTorqueMap

describe('M6 validateVehiclePreset — engineTorqueMap', () => {
  it('accepts a valid 2×2 torque map', () => {
    const r = validateVehiclePreset({
      ...VALID_BASE,
      physics: {
        engineTorqueMap: {
          axis0: [0, 1],
          axis1: [1000, 7000],
          data: [[1.0, 1.0], [1.2, 1.5]],
        },
      },
    });
    expect(r).toMatchObject({ ok: true });
  });

  it('accepts a 3×3 torque map', () => {
    const r = validateVehiclePreset({
      ...VALID_BASE,
      physics: {
        engineTorqueMap: {
          axis0: [0, 0.5, 1],
          axis1: [1000, 3500, 7000],
          data: [
            [1, 1, 1],
            [1.1, 1.3, 1.2],
            [1.2, 1.5, 1.3],
          ],
        },
      },
    });
    expect(r).toMatchObject({ ok: true });
  });

  it('rejects NaN in axis0', () => {
    const r = validateVehiclePreset({
      ...VALID_BASE,
      physics: {
        engineTorqueMap: {
          axis0: [0, NaN],
          axis1: [1000, 5000],
          data: [[1, 1], [1, 1]],
        },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some(e => e.path === 'physics.engineTorqueMap.axis0')).toBe(true);
    }
  });

  it('rejects Infinity in axis1', () => {
    const r = validateVehiclePreset({
      ...VALID_BASE,
      physics: {
        engineTorqueMap: {
          axis0: [0, 1],
          axis1: [1000, Infinity],
          data: [[1, 1], [1, 1]],
        },
      },
    });
    expect(r.ok).toBe(false);
  });

  it('rejects non-finite data row values', () => {
    const r = validateVehiclePreset({
      ...VALID_BASE,
      physics: {
        engineTorqueMap: {
          axis0: [0, 1],
          axis1: [1000, 5000],
          data: [[1, 1], [NaN, 1]],
        },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some(e => e.path.startsWith('physics.engineTorqueMap.data'))).toBe(true);
    }
  });

  it('rejects engineTorqueMap as non-object', () => {
    const r = validateVehiclePreset({
      ...VALID_BASE,
      physics: { engineTorqueMap: 42 as unknown as Record<string, unknown> },
    });
    expect(r.ok).toBe(false);
  });
});

// ------------------------------------------------------------------ engineTorqueCurve

describe('M6 validateVehiclePreset — engineTorqueCurve', () => {
  it('accepts a valid [rpm, Nm] curve with 4 points', () => {
    const r = validateVehiclePreset({
      ...VALID_BASE,
      physics: {
        engineTorqueCurve: [
          [0, 0],
          [2000, 300],
          [5000, 450],
          [8000, 0],
        ],
      },
    });
    expect(r).toMatchObject({ ok: true });
  });

  it('rejects a curve with fewer than 2 points', () => {
    const r = validateVehiclePreset({
      ...VALID_BASE,
      physics: { engineTorqueCurve: [[1000, 200]] },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some(e => e.path === 'physics.engineTorqueCurve')).toBe(true);
    }
  });

  it('rejects a curve entry that is not [number, number]', () => {
    const r = validateVehiclePreset({
      ...VALID_BASE,
      physics: {
        engineTorqueCurve: [
          [1000, 200],
          [NaN, 300],
        ] as ReadonlyArray<readonly [number, number]>,
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some(e => e.path.startsWith('physics.engineTorqueCurve'))).toBe(true);
    }
  });
});

// ------------------------------------------------------------------ shiftLogic

describe('M6 validateVehiclePreset — shiftLogic', () => {
  it('accepts a fully specified shiftLogic', () => {
    const r = validateVehiclePreset({
      ...VALID_BASE,
      physics: {
        shiftLogic: {
          upshiftMinRpm: 2500,
          upshiftMaxRpm: 9000,
          downshiftMinRpm: 0,
          downshiftMaxRpm: 8000,
          shiftTimeS: 0.12,
          shiftThrottleCutFraction: 0.75,
        },
      },
    });
    expect(r).toMatchObject({ ok: true });
  });

  it('accepts shiftLogic with only shiftTimeS', () => {
    const r = validateVehiclePreset({
      ...VALID_BASE,
      physics: { shiftLogic: { shiftTimeS: 0.1 } },
    });
    expect(r).toMatchObject({ ok: true });
  });

  it('rejects shiftTimeS < 0', () => {
    const r = validateVehiclePreset({
      ...VALID_BASE,
      physics: { shiftLogic: { shiftTimeS: -0.05 } },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some(e => e.path === 'physics.shiftLogic.shiftTimeS')).toBe(true);
    }
  });

  it('rejects shiftThrottleCutFraction > 1', () => {
    const r = validateVehiclePreset({
      ...VALID_BASE,
      physics: { shiftLogic: { shiftThrottleCutFraction: 1.1 } },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some(e => e.path === 'physics.shiftLogic.shiftThrottleCutFraction')).toBe(true);
    }
  });

  it('rejects shiftThrottleCutFraction < 0', () => {
    const r = validateVehiclePreset({
      ...VALID_BASE,
      physics: { shiftLogic: { shiftThrottleCutFraction: -0.1 } },
    });
    expect(r.ok).toBe(false);
  });

  it('rejects negative upshiftMinRpm', () => {
    const r = validateVehiclePreset({
      ...VALID_BASE,
      physics: { shiftLogic: { upshiftMinRpm: -500 } },
    });
    expect(r.ok).toBe(false);
  });

  it('rejects shiftLogic as non-object', () => {
    const r = validateVehiclePreset({
      ...VALID_BASE,
      physics: { shiftLogic: 'fast' as unknown as Record<string, unknown> },
    });
    expect(r.ok).toBe(false);
  });
});

// ------------------------------------------------------------------ drivelineCompliance

describe('M6 validateVehiclePreset — drivelineCompliance', () => {
  it('accepts a valid compliance spec', () => {
    const r = validateVehiclePreset({
      ...VALID_BASE,
      physics: {
        drivelineCompliance: {
          shaftStiffnessNmRad: 12000,
          shaftDampingNmSRad: 40,
          backlashRad: 0.008,
        },
      },
    });
    expect(r).toMatchObject({ ok: true });
  });

  it('accepts compliance with only stiffness (damping and backlash are optional)', () => {
    const r = validateVehiclePreset({
      ...VALID_BASE,
      physics: { drivelineCompliance: { shaftStiffnessNmRad: 8000 } },
    });
    expect(r).toMatchObject({ ok: true });
  });

  it('rejects negative shaftStiffnessNmRad', () => {
    const r = validateVehiclePreset({
      ...VALID_BASE,
      physics: { drivelineCompliance: { shaftStiffnessNmRad: -1 } },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some(e => e.path === 'physics.drivelineCompliance.shaftStiffnessNmRad')).toBe(true);
    }
  });

  it('rejects negative shaftDampingNmSRad', () => {
    const r = validateVehiclePreset({
      ...VALID_BASE,
      physics: { drivelineCompliance: { shaftDampingNmSRad: -5 } },
    });
    expect(r.ok).toBe(false);
  });

  it('rejects negative backlashRad', () => {
    const r = validateVehiclePreset({
      ...VALID_BASE,
      physics: { drivelineCompliance: { backlashRad: -0.01 } },
    });
    expect(r.ok).toBe(false);
  });

  it('rejects drivelineCompliance as non-object', () => {
    const r = validateVehiclePreset({
      ...VALID_BASE,
      physics: { drivelineCompliance: true as unknown as Record<string, unknown> },
    });
    expect(r.ok).toBe(false);
  });
});

// ------------------------------------------------------------------ engineBraking

describe('M6 validateVehiclePreset — engineBraking', () => {
  it('accepts a fully specified engineBraking config', () => {
    const r = validateVehiclePreset({
      ...VALID_BASE,
      physics: {
        engineBraking: {
          linearNmPerRadS: 0.05,
          constantNm: 12,
          pumpingCoeffNmPerRadS2: 0.0015,
          maxBrakeTorqueNm: 280,
        },
      },
    });
    expect(r).toMatchObject({ ok: true });
  });

  it('accepts engineBraking with only maxBrakeTorqueNm', () => {
    const r = validateVehiclePreset({
      ...VALID_BASE,
      physics: { engineBraking: { maxBrakeTorqueNm: 200 } },
    });
    expect(r).toMatchObject({ ok: true });
  });

  it('rejects negative linearNmPerRadS', () => {
    const r = validateVehiclePreset({
      ...VALID_BASE,
      physics: { engineBraking: { linearNmPerRadS: -0.1 } },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some(e => e.path === 'physics.engineBraking.linearNmPerRadS')).toBe(true);
    }
  });

  it('rejects negative maxBrakeTorqueNm', () => {
    const r = validateVehiclePreset({
      ...VALID_BASE,
      physics: { engineBraking: { maxBrakeTorqueNm: -10 } },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some(e => e.path === 'physics.engineBraking.maxBrakeTorqueNm')).toBe(true);
    }
  });

  it('rejects negative constantNm', () => {
    const r = validateVehiclePreset({
      ...VALID_BASE,
      physics: { engineBraking: { constantNm: -5 } },
    });
    expect(r.ok).toBe(false);
  });

  it('rejects engineBraking as non-object', () => {
    const r = validateVehiclePreset({
      ...VALID_BASE,
      physics: { engineBraking: [] as unknown as Record<string, unknown> },
    });
    expect(r.ok).toBe(false);
  });
});

// ------------------------------------------------------------------ backward compat

describe('M6 validateVehiclePreset — backward compat (NA presets unchanged)', () => {
  it('accepts a preset with no physics field at all', () => {
    expect(validateVehiclePreset(VALID_BASE)).toMatchObject({ ok: true });
  });

  it('accepts a preset with pre-M6 physics fields only', () => {
    const r = validateVehiclePreset({
      ...VALID_BASE,
      physics: {
        massKg: 1240,
        springFrontNpm: 65000,
        springRearNpm: 60000,
        cdAreaM2: 0.7,
        diffPreloadNm: 60,
        diffCapacityNm: 1200,
        diffPowerRamp: 0.45,
        diffCoastRamp: 0.30,
      },
    });
    expect(r).toMatchObject({ ok: true });
  });

  it('accepts a preset combining M5 aeroMap with M6 turbo', () => {
    const r = validateVehiclePreset({
      ...VALID_BASE,
      physics: {
        aeroMap: {
          frontClAreaMap: {
            axis0: [0.05, 0.1],
            axis1: [0, 5],
            data: [[0.2, 0.25], [0.22, 0.27]],
          },
        },
        turbo: {
          peakBoostBar: 1.2,
          peakTorqueMultiplier: 1.45,
        },
        shiftLogic: { shiftTimeS: 0.15 },
        drivelineCompliance: { shaftStiffnessNmRad: 10000 },
      },
    });
    expect(r).toMatchObject({ ok: true });
  });

  it('accepts a preset combining all M6 optional fields', () => {
    const r = validateVehiclePreset({
      ...VALID_BASE,
      physics: {
        turbo: { peakBoostBar: 1.0, spoolUpTimeS: 2.0, spoolDownTimeS: 3.0 },
        engineTorqueMap: {
          axis0: [0, 1],
          axis1: [1000, 6000],
          data: [[1, 1], [1.3, 1.4]],
        },
        engineTorqueCurve: [[0, 0], [5000, 500], [8500, 0]],
        shiftLogic: { upshiftMinRpm: 1500, shiftTimeS: 0.1, shiftThrottleCutFraction: 0.8 },
        drivelineCompliance: { shaftStiffnessNmRad: 9000, shaftDampingNmSRad: 25 },
        engineBraking: { linearNmPerRadS: 0.04, constantNm: 8, maxBrakeTorqueNm: 300 },
      },
    });
    expect(r).toMatchObject({ ok: true });
  });
});
