import { describe, expect, it } from 'bun:test';
import {
  GT3_RWD_SLICK_TIRE_DATASET,
  resolveTireAxleParams,
  tireDatasetFingerprint,
} from './tire-dataset.js';

describe('GT3 tire dataset pipeline', () => {
  it('exposes a versioned GT3/RWD slick dataset', () => {
    expect(GT3_RWD_SLICK_TIRE_DATASET.metadata.id).toBe('gt3-rwd-slick');
    expect(GT3_RWD_SLICK_TIRE_DATASET.metadata.carClass).toBe('gt3-rwd');
    expect(GT3_RWD_SLICK_TIRE_DATASET.metadata.version).toMatch(/^0\.1\.0/);
    expect(GT3_RWD_SLICK_TIRE_DATASET.front.fz0).toBeGreaterThan(0);
    expect(GT3_RWD_SLICK_TIRE_DATASET.relaxation.longitudinalM).toBeGreaterThan(0);
  });

  it('resolves axle params with overrides without mutating the dataset', () => {
    const base = resolveTireAxleParams(GT3_RWD_SLICK_TIRE_DATASET, 'front');
    const tuned = resolveTireAxleParams(GT3_RWD_SLICK_TIRE_DATASET, 'front', { pDx1: 1.08 });

    expect(tuned.pDx1).toBe(1.08);
    expect(base.pDx1).toBe(GT3_RWD_SLICK_TIRE_DATASET.front.pDx1);
    expect(GT3_RWD_SLICK_TIRE_DATASET.front.pDx1).not.toBe(1.08);
  });

  it('fingerprints the active data revision deterministically', () => {
    const a = tireDatasetFingerprint(GT3_RWD_SLICK_TIRE_DATASET);
    const b = tireDatasetFingerprint(GT3_RWD_SLICK_TIRE_DATASET);
    expect(a).toBe(b);
    expect(a).toContain('gt3-rwd-slick');
    expect(a).toContain(GT3_RWD_SLICK_TIRE_DATASET.metadata.version);
  });
});
