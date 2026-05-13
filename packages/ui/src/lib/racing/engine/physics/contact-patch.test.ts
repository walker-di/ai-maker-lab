import { describe, expect, it } from 'bun:test';
import {
  computeContactPatchPressureDistribution,
  computeLoadSensitiveRelaxationLength,
  computeOverturningMomentNm,
  computeSlidingGripScale,
} from './contact-patch.js';

const DEG = Math.PI / 180;

describe('contact patch pressure distribution', () => {
  it('normalizes three-strip pressure shares', () => {
    const d = computeContactPatchPressureDistribution({
      camberRad: -2 * DEG,
      pressureKpa: 200,
      optimalPressureKpa: 200,
    });
    expect(d.inner + d.middle + d.outer).toBeCloseTo(1, 8);
    expect(d.inner).toBeGreaterThan(0);
    expect(d.middle).toBeGreaterThan(0);
    expect(d.outer).toBeGreaterThan(0);
  });

  it('loads the inner strip under negative camber', () => {
    const flat = computeContactPatchPressureDistribution({
      camberRad: 0,
      pressureKpa: 200,
      optimalPressureKpa: 200,
    });
    const cambered = computeContactPatchPressureDistribution({
      camberRad: -3 * DEG,
      pressureKpa: 200,
      optimalPressureKpa: 200,
    });
    expect(cambered.inner).toBeGreaterThan(flat.inner);
    expect(cambered.centroidM).toBeLessThan(0);
  });

  it('shows over-inflation crown loading and under-inflation shoulder loading', () => {
    const low = computeContactPatchPressureDistribution({
      camberRad: 0,
      pressureKpa: 170,
      optimalPressureKpa: 220,
    });
    const high = computeContactPatchPressureDistribution({
      camberRad: 0,
      pressureKpa: 260,
      optimalPressureKpa: 220,
    });
    expect(low.inner + low.outer).toBeGreaterThan(high.inner + high.outer);
    expect(high.middle).toBeGreaterThan(low.middle);
  });

  it('computes overturning moment from pressure centroid', () => {
    const d = computeContactPatchPressureDistribution({
      camberRad: -3 * DEG,
      pressureKpa: 200,
      optimalPressureKpa: 200,
    });
    expect(computeOverturningMomentNm(3500, d)).toBeLessThan(0);
  });
});

describe('contact patch transient modifiers', () => {
  it('reduces grip as sliding speed rises', () => {
    expect(computeSlidingGripScale({ slidingSpeedMps: 0 })).toBeCloseTo(1, 8);
    expect(computeSlidingGripScale({ slidingSpeedMps: 8 })).toBeLessThan(1);
    expect(computeSlidingGripScale({ slidingSpeedMps: 100 })).toBeGreaterThanOrEqual(0.82);
  });

  it('stretches relaxation length at low load and shortens it at high load', () => {
    const lowLoad = computeLoadSensitiveRelaxationLength({ baseLengthM: 0.55, fz: 1800, fz0: 3500 });
    const highLoad = computeLoadSensitiveRelaxationLength({ baseLengthM: 0.55, fz: 6200, fz0: 3500 });
    expect(lowLoad).toBeGreaterThan(0.55);
    expect(highLoad).toBeLessThan(0.55);
  });

  it('stretches relaxation when pressure is far from the target', () => {
    const optimal = computeLoadSensitiveRelaxationLength({
      baseLengthM: 0.55,
      fz: 3500,
      pressureKpa: 220,
      optimalPressureKpa: 220,
    });
    const offPressure = computeLoadSensitiveRelaxationLength({
      baseLengthM: 0.55,
      fz: 3500,
      pressureKpa: 170,
      optimalPressureKpa: 220,
    });
    expect(offPressure).toBeGreaterThan(optimal);
  });
});
