/**
 * M7 Setup Surface — domain tests.
 *
 * Covers:
 *   - All new M7 fields present in defaultSetup()
 *   - clampSetup() clamps M7 fields to their ranges
 *   - clampSetup() fills missing M7 fields from DEFAULT_SETUP (backward compat
 *     with old pre-M7 rows)
 *   - Round-trip: clampSetup(clampSetup(v)) === clampSetup(v) (idempotent)
 */
import { describe, expect, it } from 'bun:test';
import { clampSetup, defaultSetup, DEFAULT_SETUP } from './setup-types.js';

describe('M7 defaultSetup()', () => {
  it('contains all M7 spring fields', () => {
    const s = defaultSetup();
    expect(typeof s.springFrontNpm).toBe('number');
    expect(typeof s.springRearNpm).toBe('number');
  });

  it('contains all M7 damper scaler fields', () => {
    const s = defaultSetup();
    expect(s.damperBumpFrontScale).toBe(1.0);
    expect(s.damperReboundFrontScale).toBe(1.0);
    expect(s.damperBumpRearScale).toBe(1.0);
    expect(s.damperReboundRearScale).toBe(1.0);
  });

  it('contains all M7 diff fields', () => {
    const s = defaultSetup();
    expect(s.diffPowerRamp).toBeCloseTo(0.45);
    expect(s.diffCoastRamp).toBeCloseTo(0.30);
    expect(s.diffPreloadNm).toBe(60); // matches makeDefaultDrivetrainParams for backward compat
  });

  it('contains per-corner tire pressure fields', () => {
    const s = defaultSetup();
    expect(s.tirePressureFLKpa).toBe(200);
    expect(s.tirePressureFRKpa).toBe(200);
    expect(s.tirePressureRLKpa).toBe(200);
    expect(s.tirePressureRRKpa).toBe(200);
  });

  it('contains camber fields', () => {
    const s = defaultSetup();
    expect(s.camberFrontDeg).toBeCloseTo(-1.5);
    expect(s.camberRearDeg).toBeCloseTo(-1.5);
  });

  it('contains brake bias field', () => {
    const s = defaultSetup();
    expect(s.brakeBiasFront).toBeCloseTo(0.565);
  });

  it('contains ride-height offset fields', () => {
    const s = defaultSetup();
    expect(s.rideHeightFrontMm).toBe(0);
    expect(s.rideHeightRearMm).toBe(0);
  });

  it('contains fuel load field defaulting to 0 (no mass delta)', () => {
    const s = defaultSetup();
    expect(s.fuelLoad).toBe(0);
  });

  it('contains final-drive scale field', () => {
    const s = defaultSetup();
    expect(s.finalDriveScale).toBe(1.0);
  });
});

describe('M7 clampSetup() — M7 field clamping', () => {
  it('clamps springFrontNpm to [0, 300000]', () => {
    expect(clampSetup({ springFrontNpm: -100 }).springFrontNpm).toBe(0);
    expect(clampSetup({ springFrontNpm: 500_000 }).springFrontNpm).toBe(300_000);
    expect(clampSetup({ springFrontNpm: 80_000 }).springFrontNpm).toBe(80_000);
  });

  it('clamps springRearNpm', () => {
    expect(clampSetup({ springRearNpm: -1 }).springRearNpm).toBe(0);
    expect(clampSetup({ springRearNpm: 999_999 }).springRearNpm).toBe(300_000);
  });

  it('clamps damper scalers to [0.5, 2.0]', () => {
    const s = clampSetup({
      damperBumpFrontScale: 0.1,
      damperReboundFrontScale: 5.0,
      damperBumpRearScale: 0.0,
      damperReboundRearScale: 3.0,
    });
    expect(s.damperBumpFrontScale).toBe(0.5);
    expect(s.damperReboundFrontScale).toBe(2.0);
    expect(s.damperBumpRearScale).toBe(0.5);
    expect(s.damperReboundRearScale).toBe(2.0);
  });

  it('clamps diffPowerRamp to [0, 1]', () => {
    expect(clampSetup({ diffPowerRamp: -0.5 }).diffPowerRamp).toBe(0);
    expect(clampSetup({ diffPowerRamp: 2.0 }).diffPowerRamp).toBe(1.0);
  });

  it('clamps diffPreloadNm to [0, 200]', () => {
    expect(clampSetup({ diffPreloadNm: -10 }).diffPreloadNm).toBe(0);
    expect(clampSetup({ diffPreloadNm: 500 }).diffPreloadNm).toBe(200);
  });

  it('clamps per-corner pressures to [130, 280] kPa', () => {
    const s = clampSetup({
      tirePressureFLKpa: 50,
      tirePressureFRKpa: 400,
      tirePressureRLKpa: 130,
      tirePressureRRKpa: 280,
    });
    expect(s.tirePressureFLKpa).toBe(130);
    expect(s.tirePressureFRKpa).toBe(280);
    expect(s.tirePressureRLKpa).toBe(130);
    expect(s.tirePressureRRKpa).toBe(280);
  });

  it('clamps camber to [-4.5, 0.5] deg', () => {
    expect(clampSetup({ camberFrontDeg: -10 }).camberFrontDeg).toBe(-4.5);
    expect(clampSetup({ camberFrontDeg: 2 }).camberFrontDeg).toBe(0.5);
    expect(clampSetup({ camberRearDeg: -10 }).camberRearDeg).toBe(-4.5);
  });

  it('clamps brakeBiasFront to [0.3, 0.8]', () => {
    expect(clampSetup({ brakeBiasFront: 0 }).brakeBiasFront).toBe(0.3);
    expect(clampSetup({ brakeBiasFront: 1 }).brakeBiasFront).toBe(0.8);
    expect(clampSetup({ brakeBiasFront: 0.6 }).brakeBiasFront).toBeCloseTo(0.6);
  });

  it('clamps rideHeightFrontMm to [-30, 30]', () => {
    expect(clampSetup({ rideHeightFrontMm: -100 }).rideHeightFrontMm).toBe(-30);
    expect(clampSetup({ rideHeightFrontMm: 100 }).rideHeightFrontMm).toBe(30);
  });

  it('clamps fuelLoad to [0, 1.0]', () => {
    expect(clampSetup({ fuelLoad: -0.1 }).fuelLoad).toBe(0);
    expect(clampSetup({ fuelLoad: 1.5 }).fuelLoad).toBe(1.0);
    expect(clampSetup({ fuelLoad: 0.5 }).fuelLoad).toBeCloseTo(0.5);
  });

  it('clamps finalDriveScale to [0.7, 1.5]', () => {
    expect(clampSetup({ finalDriveScale: 0.1 }).finalDriveScale).toBe(0.7);
    expect(clampSetup({ finalDriveScale: 3.0 }).finalDriveScale).toBe(1.5);
    expect(clampSetup({ finalDriveScale: 1.2 }).finalDriveScale).toBeCloseTo(1.2);
  });
});

describe('M7 clampSetup() — backward compatibility with old (pre-M7) rows', () => {
  const legacyRow = {
    frontToeDeg: 0.2,
    rearToeDeg: -0.1,
    casterDeg: 5.0,
    ackermannPct: 0.5,
    motionRatioFront: 1.0,
    motionRatioRear: 1.0,
    bumpStopGapFrontMm: 200,
    bumpStopGapRearMm: 200,
    bumpStopRateFrontNmm: 100,
    bumpStopRateRearNmm: 100,
    // M7 fields absent — simulating an old database row
  };

  it('fills all missing M7 fields with safe defaults', () => {
    const s = clampSetup(legacyRow);
    // Pre-M7 fields preserved
    expect(s.frontToeDeg).toBeCloseTo(0.2);
    expect(s.casterDeg).toBeCloseTo(5.0);
    // M7 fields filled from DEFAULT_SETUP
    expect(s.springFrontNpm).toBe(DEFAULT_SETUP.springFrontNpm);
    expect(s.springRearNpm).toBe(DEFAULT_SETUP.springRearNpm);
    expect(s.damperBumpFrontScale).toBe(DEFAULT_SETUP.damperBumpFrontScale);
    expect(s.damperReboundFrontScale).toBe(DEFAULT_SETUP.damperReboundFrontScale);
    expect(s.damperBumpRearScale).toBe(DEFAULT_SETUP.damperBumpRearScale);
    expect(s.damperReboundRearScale).toBe(DEFAULT_SETUP.damperReboundRearScale);
    expect(s.diffPowerRamp).toBeCloseTo(DEFAULT_SETUP.diffPowerRamp);
    expect(s.diffCoastRamp).toBeCloseTo(DEFAULT_SETUP.diffCoastRamp);
    expect(s.diffPreloadNm).toBe(DEFAULT_SETUP.diffPreloadNm);
    expect(s.tirePressureFLKpa).toBe(DEFAULT_SETUP.tirePressureFLKpa);
    expect(s.tirePressureFRKpa).toBe(DEFAULT_SETUP.tirePressureFRKpa);
    expect(s.tirePressureRLKpa).toBe(DEFAULT_SETUP.tirePressureRLKpa);
    expect(s.tirePressureRRKpa).toBe(DEFAULT_SETUP.tirePressureRRKpa);
    expect(s.camberFrontDeg).toBeCloseTo(DEFAULT_SETUP.camberFrontDeg);
    expect(s.camberRearDeg).toBeCloseTo(DEFAULT_SETUP.camberRearDeg);
    expect(s.brakeBiasFront).toBeCloseTo(DEFAULT_SETUP.brakeBiasFront);
    expect(s.rideHeightFrontMm).toBe(DEFAULT_SETUP.rideHeightFrontMm);
    expect(s.rideHeightRearMm).toBe(DEFAULT_SETUP.rideHeightRearMm);
    expect(s.fuelLoad).toBe(DEFAULT_SETUP.fuelLoad); // 0 = no mass delta
    expect(s.finalDriveScale).toBe(DEFAULT_SETUP.finalDriveScale);
  });

  it('produces a complete SetupValues (no undefined fields)', () => {
    const s = clampSetup(legacyRow);
    for (const [key, value] of Object.entries(s)) {
      expect(value, `field ${key} should not be undefined`).not.toBeUndefined();
      expect(typeof value, `field ${key} should be a number`).toBe('number');
    }
  });
});

describe('M7 clampSetup() — idempotent', () => {
  it('clampSetup(clampSetup(x)) === clampSetup(x)', () => {
    const first = clampSetup({
      frontToeDeg: 5,
      springFrontNpm: -1,
      camberFrontDeg: -20,
      fuelLoad: 2,
      finalDriveScale: 0,
    });
    const second = clampSetup(first);
    expect(second).toEqual(first);
  });
});

describe('M7 clampSetup() — NaN/non-finite fallback', () => {
  it('replaces NaN with default value', () => {
    const s = clampSetup({ springFrontNpm: NaN, brakeBiasFront: NaN });
    expect(s.springFrontNpm).toBe(DEFAULT_SETUP.springFrontNpm);
    expect(s.brakeBiasFront).toBeCloseTo(DEFAULT_SETUP.brakeBiasFront);
  });

  it('replaces non-finite values with the default fallback (then clamps)', () => {
    const s = clampSetup({ tirePressureFLKpa: Infinity, tirePressureRRKpa: -Infinity });
    // Non-finite values use the DEFAULT_SETUP value as the fallback.
    expect(s.tirePressureFLKpa).toBe(DEFAULT_SETUP.tirePressureFLKpa);
    expect(s.tirePressureRRKpa).toBe(DEFAULT_SETUP.tirePressureRRKpa);
  });
});
