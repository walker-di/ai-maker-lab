import { describe, expect, it } from 'bun:test';
import { hubNaturalFrequencyHz, hubCriticalDampingNspm } from './compliance-math.js';

describe('hubNaturalFrequencyHz', () => {
  it('is ~13.8 Hz for GT3 bushing parameters (20 kg, 150 kN/m)', () => {
    const f = hubNaturalFrequencyHz(150_000, 20);
    expect(f).toBeCloseTo(13.8, 0);
  });

  it('increases with stiffness', () => {
    const f1 = hubNaturalFrequencyHz(100_000, 20);
    const f2 = hubNaturalFrequencyHz(200_000, 20);
    expect(f2).toBeGreaterThan(f1);
  });

  it('decreases with mass', () => {
    const f1 = hubNaturalFrequencyHz(150_000, 15);
    const f2 = hubNaturalFrequencyHz(150_000, 25);
    expect(f2).toBeLessThan(f1);
  });

  it('is zero for zero stiffness', () => {
    expect(hubNaturalFrequencyHz(0, 20)).toBe(0);
  });

  it('stays within 5–20 Hz for typical parameters', () => {
    expect(hubNaturalFrequencyHz(150_000, 20)).toBeGreaterThanOrEqual(5);
    expect(hubNaturalFrequencyHz(150_000, 20)).toBeLessThanOrEqual(20);
  });
});

describe('hubCriticalDampingNspm', () => {
  it('scales with sqrt(k*m)', () => {
    const c1 = hubCriticalDampingNspm(150_000, 20);
    const c2 = hubCriticalDampingNspm(150_000, 80);
    expect(c2).toBeCloseTo(c1 * 2, 3);
  });

  it('is positive for typical parameters', () => {
    expect(hubCriticalDampingNspm(150_000, 20)).toBeGreaterThan(0);
  });
});
