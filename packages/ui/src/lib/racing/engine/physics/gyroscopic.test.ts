/**
 * M8: Gyroscopic torque from spinning wheels.
 */
import { describe, it, expect } from 'bun:test';
import { computeGyroscopicTorque } from './gyroscopic.js';

describe('computeGyroscopicTorque', () => {
  it('returns zero for non-finite inputs', () => {
    expect(computeGyroscopicTorque({ wheelOmega: NaN, wheelInertia: 1.4, steerRate: 1 }))
      .toEqual({ torqueRollNm: 0, torquePitchNm: 0 });
    expect(computeGyroscopicTorque({ wheelOmega: 100, wheelInertia: Infinity, steerRate: 1 }))
      .toEqual({ torqueRollNm: 0, torquePitchNm: 0 });
  });

  it('computes roll torque as I_w * omega * steerRate', () => {
    const r = computeGyroscopicTorque({ wheelOmega: 100, wheelInertia: 1.4, steerRate: 2 });
    expect(r.torqueRollNm).toBeCloseTo(1.4 * 100 * 2, 5);
    expect(r.torquePitchNm).toBe(0);
  });

  it('preserves sign convention', () => {
    const pos = computeGyroscopicTorque({ wheelOmega: 100, wheelInertia: 1.4, steerRate: 1 });
    const neg = computeGyroscopicTorque({ wheelOmega: 100, wheelInertia: 1.4, steerRate: -1 });
    expect(pos.torqueRollNm).toBeCloseTo(-neg.torqueRollNm, 5);
  });

  it('scales linearly with each input', () => {
    const base = computeGyroscopicTorque({ wheelOmega: 50, wheelInertia: 1, steerRate: 1 });
    const doubleOmega = computeGyroscopicTorque({ wheelOmega: 100, wheelInertia: 1, steerRate: 1 });
    const doubleInertia = computeGyroscopicTorque({ wheelOmega: 50, wheelInertia: 2, steerRate: 1 });
    const doubleSteer = computeGyroscopicTorque({ wheelOmega: 50, wheelInertia: 1, steerRate: 2 });

    expect(doubleOmega.torqueRollNm).toBeCloseTo(base.torqueRollNm * 2, 5);
    expect(doubleInertia.torqueRollNm).toBeCloseTo(base.torqueRollNm * 2, 5);
    expect(doubleSteer.torqueRollNm).toBeCloseTo(base.torqueRollNm * 2, 5);
  });

  it('returns zero torque when wheel is stationary', () => {
    const r = computeGyroscopicTorque({ wheelOmega: 0, wheelInertia: 1.4, steerRate: 5 });
    expect(r.torqueRollNm).toBe(0);
  });

  it('returns zero torque when steer rate is zero', () => {
    const r = computeGyroscopicTorque({ wheelOmega: 200, wheelInertia: 1.4, steerRate: 0 });
    expect(r.torqueRollNm).toBe(0);
  });
});
