import { describe, expect, it } from 'bun:test';
import { applyCorneringBrakeControl } from './brake-balance.js';

describe('cornering brake control', () => {
  it('returns 1 for every wheel when axle loads are equal', () => {
    const r = applyCorneringBrakeControl([3000, 3000, 2500, 2500]);
    expect(r[0]).toBeCloseTo(1, 8);
    expect(r[1]).toBeCloseTo(1, 8);
    expect(r[2]).toBeCloseTo(1, 8);
    expect(r[3]).toBeCloseTo(1, 8);
  });

  it('reduces brake on the unloaded inside wheel and adds on the loaded outside wheel', () => {
    // Left turn: weight on the right (outside). FL=2200, FR=4000 (60/40 split).
    const r = applyCorneringBrakeControl([2200, 4000, 2400, 3200], { k: 0.6 });
    expect(r[0]).toBeLessThan(1);
    expect(r[1]).toBeGreaterThan(1);
    expect(r[0]).toBeLessThan(r[1]);
    // Mirror property: scales sum to 2 across the front axle (load-proportional).
    expect(r[0] + r[1]).toBeCloseTo(2, 6);
  });

  it('respects the k factor — k=0 disables balancing', () => {
    const r = applyCorneringBrakeControl([1000, 4000, 2500, 2500], { k: 0 });
    expect(r[0]).toBeCloseTo(1, 8);
    expect(r[1]).toBeCloseTo(1, 8);
  });

  it('clamps a lifted wheel to (1 - k) without going negative', () => {
    // k=0.6, fz=0 ⇒ ratio=0 ⇒ scale = 1 - 0.6 + 0 = 0.4.
    const r = applyCorneringBrakeControl([0, 4000, 2500, 2500], { k: 0.6 });
    expect(r[0]).toBeCloseTo(0.4, 6);
    expect(r[0]).toBeGreaterThanOrEqual(0);
  });

  it('pathological zero-load axle returns 1 (no scale) instead of NaN', () => {
    const r = applyCorneringBrakeControl([0, 0, 2500, 2500], { k: 0.6 });
    expect(r[0]).toBe(1);
    expect(r[1]).toBe(1);
  });

  it('clamps k input to [0, 1]', () => {
    const tooHigh = applyCorneringBrakeControl([2000, 4000, 2500, 2500], { k: 5 });
    const justOne = applyCorneringBrakeControl([2000, 4000, 2500, 2500], { k: 1 });
    expect(tooHigh[0]).toBeCloseTo(justOne[0], 8);
    expect(tooHigh[1]).toBeCloseTo(justOne[1], 8);
  });
});
