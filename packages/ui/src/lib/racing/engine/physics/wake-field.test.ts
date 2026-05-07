/**
 * M8: Wake-field / slipstream drag-reduction tests.
 */
import { describe, it, expect } from 'bun:test';
import { computeWakeEffect, type WakeEffectInput } from './aero.js';

function makeInput(overrides: Partial<WakeEffectInput> = {}): WakeEffectInput {
  return {
    leadCarPos: { x: 0, y: 0, z: 0 },
    leadCarVel: { x: 0, y: 0, z: 30 },
    followerPos: { x: 0, y: 0, z: 10 },
    wakeLengthM: 20,
    wakeWidthM: 4,
    wakeReductionPct: 0.25,
    ...overrides,
  };
}

describe('computeWakeEffect', () => {
  it('returns zero reduction when follower is ahead of lead', () => {
    const r = computeWakeEffect(makeInput({ followerPos: { x: 0, y: 0, z: 5 } }));
    expect(r.wakeReduction).toBe(0);
  });

  it('returns zero reduction when follower is beyond wake length', () => {
    const r = computeWakeEffect(makeInput({ followerPos: { x: 0, y: 0, z: -25 } }));
    expect(r.wakeReduction).toBe(0);
  });

  it('returns zero reduction when follower is laterally outside wake width', () => {
    const r = computeWakeEffect(makeInput({ followerPos: { x: 5, y: 0, z: -10 } }));
    expect(r.wakeReduction).toBe(0);
  });

  it('returns zero reduction when lead car is stationary', () => {
    const r = computeWakeEffect(makeInput({ leadCarVel: { x: 0, y: 0, z: 0 } }));
    expect(r.wakeReduction).toBe(0);
  });

  it('returns zero for non-positive wake params', () => {
    expect(computeWakeEffect(makeInput({ wakeLengthM: 0 })).wakeReduction).toBe(0);
    expect(computeWakeEffect(makeInput({ wakeWidthM: -1 })).wakeReduction).toBe(0);
    expect(computeWakeEffect(makeInput({ wakeReductionPct: 0 })).wakeReduction).toBe(0);
  });

  it('gives near-full reduction at bumper distance on centreline', () => {
    const r = computeWakeEffect(makeInput({ followerPos: { x: 0, y: 0, z: -0.001 } }));
    expect(r.wakeReduction).toBeCloseTo(0.25, 3);
  });

  it('scales linearly with longitudinal distance', () => {
    const close = computeWakeEffect(makeInput({ followerPos: { x: 0, y: 0, z: -5 } }));
    const far = computeWakeEffect(makeInput({ followerPos: { x: 0, y: 0, z: -15 } }));
    expect(close.wakeReduction).toBeGreaterThan(far.wakeReduction);
    expect(far.wakeReduction).toBeCloseTo(0.25 * 0.25, 5); // 5m remaining of 20m
  });

  it('scales linearly with lateral offset', () => {
    const centre = computeWakeEffect(makeInput({ followerPos: { x: 0, y: 0, z: -5 } }));
    const edge = computeWakeEffect(makeInput({ followerPos: { x: 2, y: 0, z: -5 } }));
    expect(centre.wakeReduction).toBeGreaterThan(edge.wakeReduction);
    expect(edge.wakeReduction).toBeCloseTo(centre.wakeReduction * 0.5, 5);
  });

  it('respects arbitrary lead direction (not just +Z)', () => {
    const r = computeWakeEffect(makeInput({
      leadCarVel: { x: 20, y: 0, z: 0 },
      followerPos: { x: -15, y: 0, z: 0 },
    }));
    expect(r.wakeReduction).toBeGreaterThan(0);
    expect(r.wakeReduction).toBeCloseTo(0.25 * 0.25, 5); // 15m behind of 20m
  });

  it('returns zero when follower is directly beside lead', () => {
    const r = computeWakeEffect(makeInput({
      followerPos: { x: 3, y: 0, z: 0 },
    }));
    expect(r.wakeReduction).toBe(0);
  });
});
