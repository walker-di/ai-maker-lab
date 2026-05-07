/**
 * M3 — damper-curve unit tests.
 *
 * Verifies multi-knee damper behaviour: sign, continuity at the knee,
 * monotonicity, and fallback to defaults when params are omitted.
 */
import { describe, test, expect } from 'bun:test';
import {
  computeDamperForce,
  bumKneeForce,
  reboundKneeForce,
  DEFAULT_DAMPER_KNEE_PARAMS,
  DEFAULT_DAMPER_KNEE_PARAMS_REAR,
  type DamperKneeParams,
} from './damper-curve.js';

describe('computeDamperForce', () => {
  test('zero velocity returns zero', () => {
    expect(computeDamperForce(0, DEFAULT_DAMPER_KNEE_PARAMS)).toBe(0);
  });

  test('positive velocity (bump) returns positive force', () => {
    const f = computeDamperForce(0.02, DEFAULT_DAMPER_KNEE_PARAMS);
    expect(f).toBeGreaterThan(0);
  });

  test('negative velocity (rebound) returns negative force', () => {
    const f = computeDamperForce(-0.02, DEFAULT_DAMPER_KNEE_PARAMS);
    expect(f).toBeLessThan(0);
  });

  test('low-speed bump slope equals LSB before the knee', () => {
    const p = DEFAULT_DAMPER_KNEE_PARAMS;
    const v = p.kneeB * 0.5; // well inside LS region
    expect(computeDamperForce(v, p)).toBeCloseTo(p.lsb * v, 3);
  });

  test('low-speed rebound slope equals LSR before the knee', () => {
    const p = DEFAULT_DAMPER_KNEE_PARAMS;
    const v = p.kneeR * 0.5;
    expect(computeDamperForce(-v, p)).toBeCloseTo(-(p.lsr * v), 3);
  });

  test('force is continuous at the bump knee', () => {
    const p = DEFAULT_DAMPER_KNEE_PARAMS;
    const fBelow = computeDamperForce(p.kneeB - 1e-6, p);
    const fAt = computeDamperForce(p.kneeB, p);
    const fAbove = computeDamperForce(p.kneeB + 1e-6, p);
    expect(Math.abs(fAt - fBelow)).toBeLessThan(1); // N — continuous
    expect(Math.abs(fAbove - fAt)).toBeLessThan(1);
  });

  test('force is continuous at the rebound knee', () => {
    const p = DEFAULT_DAMPER_KNEE_PARAMS;
    const fBelow = computeDamperForce(-(p.kneeR - 1e-6), p);
    const fAt = computeDamperForce(-p.kneeR, p);
    const fAbove = computeDamperForce(-(p.kneeR + 1e-6), p);
    expect(Math.abs(fAt - fBelow)).toBeLessThan(1);
    expect(Math.abs(fAbove - fAt)).toBeLessThan(1);
  });

  test('force magnitude grows monotonically with speed on bump side', () => {
    const p = DEFAULT_DAMPER_KNEE_PARAMS;
    const speeds = [0.01, 0.04, 0.08, 0.12, 0.25, 0.5, 1.0];
    for (let i = 1; i < speeds.length; i++) {
      const fLow = computeDamperForce(speeds[i - 1], p);
      const fHigh = computeDamperForce(speeds[i], p);
      expect(fHigh).toBeGreaterThan(fLow);
    }
  });

  test('force magnitude grows monotonically with speed on rebound side', () => {
    const p = DEFAULT_DAMPER_KNEE_PARAMS;
    const speeds = [0.01, 0.04, 0.08, 0.12, 0.25, 0.5, 1.0];
    for (let i = 1; i < speeds.length; i++) {
      const fLow = Math.abs(computeDamperForce(-speeds[i - 1], p));
      const fHigh = Math.abs(computeDamperForce(-speeds[i], p));
      expect(fHigh).toBeGreaterThan(fLow);
    }
  });

  test('high-speed rate (HSB) is lower than low-speed rate (LSB)', () => {
    // Above the knee, additional velocity contributes at HSB < LSB rate.
    const p = DEFAULT_DAMPER_KNEE_PARAMS;
    expect(p.hsb).toBeLessThan(p.lsb);
  });

  test('falls back to DEFAULT_DAMPER_KNEE_PARAMS when params is undefined', () => {
    const v = 0.05;
    expect(computeDamperForce(v, undefined)).toBe(
      computeDamperForce(v, DEFAULT_DAMPER_KNEE_PARAMS),
    );
  });

  test('custom params produce distinct force from defaults', () => {
    const custom: DamperKneeParams = {
      lsb: 8000,
      hsb: 3000,
      kneeB: 0.05,
      lsr: 10000,
      hsr: 4000,
      kneeR: 0.05,
    };
    const v = 0.03;
    expect(computeDamperForce(v, custom)).not.toBe(
      computeDamperForce(v, DEFAULT_DAMPER_KNEE_PARAMS),
    );
  });

  test('bumKneeForce and reboundKneeForce match formula', () => {
    const p = DEFAULT_DAMPER_KNEE_PARAMS;
    expect(bumKneeForce(p)).toBeCloseTo(p.lsb * p.kneeB, 3);
    expect(reboundKneeForce(p)).toBeCloseTo(p.lsr * p.kneeR, 3);
  });

  test('rear default has higher LSB than front default', () => {
    expect(DEFAULT_DAMPER_KNEE_PARAMS_REAR.lsb).toBeGreaterThan(
      DEFAULT_DAMPER_KNEE_PARAMS.lsb,
    );
  });
});
