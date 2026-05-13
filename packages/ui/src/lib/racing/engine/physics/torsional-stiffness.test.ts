import { describe, expect, it } from 'bun:test';
import { torsionalRestoringTorqueNm, chassisRollFromRightY } from './compliance-math.js';

describe('torsionalRestoringTorqueNm', () => {
  it('returns zero when roll is zero', () => {
    expect(torsionalRestoringTorqueNm(0, 22000)).toBeCloseTo(0, 6);
  });

  it('opposes positive roll with negative torque', () => {
    const rollRad = 2 * (Math.PI / 180);
    const torque = torsionalRestoringTorqueNm(rollRad, 22000);
    expect(torque).toBeLessThan(0);
  });

  it('scales linearly with roll angle', () => {
    const t1 = torsionalRestoringTorqueNm(1 * (Math.PI / 180), 22000);
    const t2 = torsionalRestoringTorqueNm(2 * (Math.PI / 180), 22000);
    expect(t2).toBeCloseTo(t1 * 2, 3);
  });

  it('settles to τ/k when constant torque is applied', () => {
    // Sanity check: for a linear torsional spring, roll = torque / k
    const kNmDeg = 22000;
    const kRad = kNmDeg * (Math.PI / 180);
    const appliedTorque = 1000;
    const expectedRoll = appliedTorque / kRad;
    const restoring = torsionalRestoringTorqueNm(expectedRoll, kNmDeg);
    expect(restoring).toBeCloseTo(-appliedTorque, 3);
  });
});

describe('chassisRollFromRightY', () => {
  it('returns zero when right vector is horizontal', () => {
    expect(chassisRollFromRightY(0)).toBeCloseTo(0, 6);
  });

  it('returns positive roll when right.y is negative (banked left)', () => {
    // rightY = -sin(roll)  =>  roll = asin(-rightY)
    const rightY = -Math.sin(5 * (Math.PI / 180));
    expect(chassisRollFromRightY(rightY)).toBeCloseTo(5 * (Math.PI / 180), 5);
  });

  it('clamps to ±π/2 for extreme values', () => {
    expect(chassisRollFromRightY(10)).toBeCloseTo(-Math.PI / 2, 5);
    expect(chassisRollFromRightY(-10)).toBeCloseTo(Math.PI / 2, 5);
  });
});
