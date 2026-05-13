import { describe, expect, it } from 'bun:test';
import {
  computeAckermannAngles,
  computeBumpStopForce,
  computeCasterCamber,
  computeMotionRatio,
  computeSlipAngleRad,
  computeToeSlipOffset,
  computeWheelHeadingBasis,
  engineTorqueAt,
  pacejkaLat,
  pacejkaLong,
  tireD,
} from './index.js';

describe('racing sim physics helpers', () => {
  it('tireD degrades with higher load', () => {
    expect(tireD(1, 7000)).toBeLessThan(2 * tireD(1, 3500));
    expect(tireD(1, 0)).toBe(0);
  });

  it('pacejkaLat peaks in the expected slip-angle range', () => {
    expect(pacejkaLat(0, 3500, 1)).toBeCloseTo(0, 8);
    expect(pacejkaLat(5 * Math.PI / 180, 3500, 1)).toBeCloseTo(-pacejkaLat(-5 * Math.PI / 180, 3500, 1), 8);
    let bestDeg = 0;
    let bestForce = -Infinity;
    for (let deg = 0; deg <= 15; deg += 0.25) {
      const force = Math.abs(pacejkaLat(deg * Math.PI / 180, 3500, 1));
      if (force > bestForce) {
        bestForce = force;
        bestDeg = deg;
      }
    }
    expect(bestDeg).toBeGreaterThan(5);
    expect(bestDeg).toBeLessThan(9);
  });

  it('pacejkaLong peaks near typical race-tire slip ratio', () => {
    expect(pacejkaLong(0, 3500, 1)).toBeCloseTo(0, 8);
    expect(pacejkaLong(0.08, 3500, 1)).toBeCloseTo(-pacejkaLong(-0.08, 3500, 1), 8);
    let bestSlip = 0;
    let bestForce = -Infinity;
    for (let slip = 0; slip <= 0.2; slip += 0.0025) {
      const force = Math.abs(pacejkaLong(slip, 3500, 1));
      if (force > bestForce) {
        bestForce = force;
        bestSlip = slip;
      }
    }
    expect(bestSlip).toBeGreaterThan(0.07);
    expect(bestSlip).toBeLessThan(0.22);
  });

  it('engine torque follows the expected curve bounds', () => {
    expect(engineTorqueAt(0)).toBe(0);
    expect(engineTorqueAt(9200)).toBe(0);
    // Curve was retuned to ~250 hp/ton, peak around 405 Nm at 5500 rpm.
    const peak = Math.max(engineTorqueAt(5000), engineTorqueAt(5500), engineTorqueAt(6000));
    expect(peak).toBeGreaterThan(380);
    expect(peak).toBeLessThan(430);
  });

  it('toe slip offsets follow front/rear conventions', () => {
    expect(computeToeSlipOffset(0, 1, 'front')).toBe(0);
    expect(computeToeSlipOffset(0.2, 1, 'front')).toBeGreaterThan(0);
    expect(computeToeSlipOffset(0.2, 1, 'rear')).toBeLessThan(0);
  });

  it('ackermann gives the inner wheel more angle', () => {
    const pair = computeAckermannAngles(12 * Math.PI / 180, 2.9, 1.7, 1);
    expect(pair.leftRad).toBeGreaterThan(pair.rightRad);
    const delta = 1 / Math.tan(pair.outerRad) - 1 / Math.tan(pair.innerRad);
    expect(delta).toBeCloseTo(1.7 / 2.9, 1);
  });

  it('wheel heading basis mirrors left and right steer correctly', () => {
    const straight = computeWheelHeadingBasis(0);
    const left = computeWheelHeadingBasis(12 * Math.PI / 180);
    const right = computeWheelHeadingBasis(-12 * Math.PI / 180);

    expect(straight.forwardX).toBeCloseTo(0, 8);
    expect(straight.forwardZ).toBeCloseTo(1, 8);
    expect(straight.lateralX).toBeCloseTo(1, 8);
    expect(straight.lateralZ).toBeCloseTo(0, 8);

    expect(left.forwardX).toBeLessThan(0);
    expect(right.forwardX).toBeGreaterThan(0);
    expect(left.forwardX).toBeCloseTo(-right.forwardX, 8);
    expect(left.forwardZ).toBeCloseTo(right.forwardZ, 8);
    expect(left.lateralX).toBeCloseTo(right.lateralX, 8);
    expect(left.lateralZ).toBeCloseTo(-right.lateralZ, 8);
  });

  it('legacy computeSlipAngleRad still encodes the historical 1.5 m/s clamp for back-compat', () => {
    // The engine pipeline no longer uses this helper — it has been
    // replaced by `computeWheelSlipTargets` + `stepRelaxedSlip` which
    // remove the artificial low-speed cliff. The helper is kept only so
    // external callers / regression baselines still work; this test
    // pins its historical behaviour rather than the new tire frame.
    expect(computeSlipAngleRad(20, 0)).toBeCloseTo(0, 8);
    expect(computeSlipAngleRad(20, 2)).toBeLessThan(0);
    expect(computeSlipAngleRad(20, -2)).toBeGreaterThan(0);
    expect(computeSlipAngleRad(20, 2)).toBeCloseTo(-computeSlipAngleRad(20, -2), 8);
    expect(computeSlipAngleRad(0.2, 2)).toBeCloseTo(computeSlipAngleRad(1.5, 2), 8);
  });

  it('motion ratio scales rates quadratically', () => {
    expect(computeMotionRatio(65000, 1)).toBe(65000);
    expect(computeMotionRatio(65000, 0.7)).toBeCloseTo(65000 * 0.49, 8);
  });

  it('bump-stop force is continuous and monotonic past threshold', () => {
    expect(computeBumpStopForce(0.1, 0.12, 100000)).toBe(0);
    const justOver = computeBumpStopForce(0.121, 0.12, 100000);
    const furtherOver = computeBumpStopForce(0.14, 0.12, 100000);
    expect(justOver).toBeGreaterThan(0);
    expect(furtherOver).toBeGreaterThan(justOver);
  });

  it('caster adds negative camber under steering lock', () => {
    expect(computeCasterCamber(0, 6)).toBeCloseTo(0, 8);
    expect(computeCasterCamber(0.3, 6)).toBeLessThan(0);
    expect(computeCasterCamber(0.3, 0)).toBeCloseTo(0, 8);
  });
});
