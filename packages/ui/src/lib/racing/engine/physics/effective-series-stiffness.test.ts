import { describe, expect, it } from 'bun:test';
import {
  effectiveSeriesStiffness,
  DEFAULT_TIRE_CARCASS_STIFFNESS_NPM,
} from './compliance-math.js';

describe('effectiveSeriesStiffness', () => {
  it('returns spring rate when compliance is zero (rigid fallback)', () => {
    const kSpring = 65000;
    const kEff = effectiveSeriesStiffness(kSpring, 0, DEFAULT_TIRE_CARCASS_STIFFNESS_NPM);
    // 1/k_eff = 1/k_carcass + 1/k_spring  (k_bushing = infinity, so 1/k_bushing = 0)
    const expected = 1 / (1 / DEFAULT_TIRE_CARCASS_STIFFNESS_NPM + 1 / kSpring);
    expect(kEff).toBeCloseTo(expected, 3);
  });

  it('accounts for bushing compliance in series', () => {
    const kSpring = 65000;
    const kBushing = 150000;
    const kEff = effectiveSeriesStiffness(kSpring, kBushing, DEFAULT_TIRE_CARCASS_STIFFNESS_NPM);
    const expected = 1 / (1 / DEFAULT_TIRE_CARCASS_STIFFNESS_NPM + 1 / kBushing + 1 / kSpring);
    expect(kEff).toBeCloseTo(expected, 3);
  });

  it('is lower than the softest spring in the chain', () => {
    const kSpring = 200000;
    const kBushing = 100000;
    const kEff = effectiveSeriesStiffness(kSpring, kBushing, DEFAULT_TIRE_CARCASS_STIFFNESS_NPM);
    expect(kEff).toBeLessThan(kBushing);
    expect(kEff).toBeLessThan(kSpring);
  });
});
