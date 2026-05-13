/**
 * Phase 7 helper coverage for the Pacejka MF 5.6 evaluator.
 *
 * The legacy `pacejkaLat` / `pacejkaLong` curves already have peak-shape
 * coverage in `index.test.ts`. This file focuses on the new `Phase 2`
 * combined-slip evaluator (`evaluatePacejka56Combined`):
 *
 *   - Pure longitudinal input collapses Fy to zero and Fx to the pure
 *     longitudinal curve.
 *   - Pure lateral input collapses Fx to zero and Fy to the pure lateral
 *     curve.
 *   - Combined-slip weighting is monotonic and bounded — both factors stay
 *     in `[0, 1]`, peak at 1 when the off-axis slip is zero, and decay
 *     smoothly with off-axis slip.
 *   - Force signs are odd-symmetric around zero slip on both axes.
 *   - Load sensitivity is monotonic in Fz for typical inputs but the
 *     per-wheel grip response stays sub-linear (peak Fx / Fz drops as Fz
 *     grows past the reference load).
 *   - Combined slip does NOT collapse `Fx` to zero at drift-angle lateral
 *     slip — the floor is structural, not arbitrary, and the engine no
 *     longer needs the legacy 0.35 floor.
 *   - Pure peak diagnostics are non-zero and consistent with the curve
 *     shape so callers can build telemetry like `kappa / kappaPeak`.
 */

import { describe, expect, it } from 'bun:test';
import {
  DEFAULT_PACEJKA56_PARAMS,
  evaluatePacejka56Combined,
  pacejkaLat,
  pacejkaLong,
} from './index.js';

const DEG = Math.PI / 180;
const FZ_REF = DEFAULT_PACEJKA56_PARAMS.fz0;

function mfCall(kappa: number, alphaRad: number, fz: number = FZ_REF, muScale = 1) {
  return evaluatePacejka56Combined({
    kappa,
    alphaRad,
    fz,
    muScale,
    axle: 'rear',
  });
}

describe('evaluatePacejka56Combined — pure-slip projections', () => {
  it('returns zero at zero slip on both axes', () => {
    const r = mfCall(0, 0);
    expect(r.fx).toBe(0);
    expect(r.fy).toBe(0);
    expect(r.gxAlpha).toBeCloseTo(1, 8);
    expect(r.gyKappa).toBeCloseTo(1, 8);
  });

  it('pure longitudinal input collapses Fy to zero and equals the pure-slip Fx', () => {
    const r = mfCall(0.1, 0);
    expect(r.fy).toBeCloseTo(0, 6);
    expect(r.fx).toBeCloseTo(r.fxPure, 8);
    expect(r.gxAlpha).toBeCloseTo(1, 8);
  });

  it('pure lateral input collapses Fx to zero and equals the pure-slip Fy', () => {
    const r = mfCall(0, 6 * DEG);
    expect(r.fx).toBeCloseTo(0, 6);
    expect(r.fy).toBeCloseTo(r.fyPure, 8);
    expect(r.gyKappa).toBeCloseTo(1, 8);
  });

  it('returns zero across the board when fz or muScale is zero', () => {
    const noLoad = mfCall(0.1, 5 * DEG, 0);
    const noGrip = mfCall(0.1, 5 * DEG, FZ_REF, 0);
    expect(noLoad.fx).toBe(0);
    expect(noLoad.fy).toBe(0);
    expect(noGrip.fx).toBe(0);
    expect(noGrip.fy).toBe(0);
  });
});

describe('evaluatePacejka56Combined — combined-slip weighting', () => {
  it('combined slip cuts each axis smoothly without zeroing them', () => {
    const driftLikeAlpha = 12 * DEG;
    const driveSlip = 0.18;
    const r = mfCall(driveSlip, driftLikeAlpha);
    // Combined-slip cosines are normalized: 1 at the off-axis-zero limit,
    // smoothly decaying with off-axis slip and >= 0.
    expect(r.gxAlpha).toBeGreaterThan(0);
    expect(r.gxAlpha).toBeLessThan(1);
    expect(r.gyKappa).toBeGreaterThan(0);
    expect(r.gyKappa).toBeLessThan(1);
    // Fx should keep meaningful magnitude (≥ 25% of pure-slip Fx) so the
    // sliding driver can still load the rear axle on throttle.
    expect(Math.abs(r.fx)).toBeGreaterThan(Math.abs(r.fxPure) * 0.25);
    expect(Math.abs(r.fy)).toBeGreaterThan(Math.abs(r.fyPure) * 0.25);
  });

  it('combined-slip weighting is monotonic in the off-axis slip magnitude', () => {
    const driveSlip = 0.15;
    const small = mfCall(driveSlip, 2 * DEG);
    const med = mfCall(driveSlip, 6 * DEG);
    const large = mfCall(driveSlip, 12 * DEG);
    expect(small.gxAlpha).toBeGreaterThan(med.gxAlpha);
    expect(med.gxAlpha).toBeGreaterThan(large.gxAlpha);
  });

  it('does NOT double-penalize via a friction-circle clamp downstream', () => {
    // The combined-slip evaluator already saturates each axis through
    // smooth cosine weighting, so the magnitude is bounded by the
    // friction-circle ceiling `mu * Fz` without needing an isotropic clamp
    // downstream. As a regression guard, confirm the magnitude stays
    // within that physical ceiling at extreme combined slip.
    const r = mfCall(0.2, 10 * DEG, FZ_REF, 1);
    const mag = Math.hypot(r.fx, r.fy);
    expect(Number.isFinite(mag)).toBe(true);
    // mu * fz is the physical ceiling; allow margin for the MF peak
    // coefficients (pDx1/pDy1) being slightly above 1 by design and for
    // the combined-slip vector being the geometric sum of two axes that
    // are both at near-peak weighting.
    expect(mag).toBeLessThanOrEqual(FZ_REF * 1.3);
    // And the combined Fx is strictly less than the pure-slip Fx because
    // the gxAlpha factor is < 1 (we're at non-zero alpha). This confirms
    // combined slip cuts the axis without zeroing it.
    expect(Math.abs(r.fx)).toBeLessThan(Math.abs(r.fxPure));
    expect(Math.abs(r.fy)).toBeLessThan(Math.abs(r.fyPure));
  });
});

describe('evaluatePacejka56Combined — sign symmetry', () => {
  it('Fx is odd-symmetric in slipRatio at fixed slipAngle', () => {
    const a = mfCall(0.1, 4 * DEG);
    const b = mfCall(-0.1, 4 * DEG);
    expect(a.fx).toBeCloseTo(-b.fx, 6);
  });

  it('Fy is odd-symmetric in slipAngle at fixed slipRatio', () => {
    const a = mfCall(0.05, 5 * DEG);
    const b = mfCall(0.05, -5 * DEG);
    expect(a.fy).toBeCloseTo(-b.fy, 6);
  });

  it('gxAlpha and gyKappa are even functions of their off-axis slip', () => {
    const aPos = mfCall(0.1, 5 * DEG);
    const aNeg = mfCall(0.1, -5 * DEG);
    const kPos = mfCall(0.05, 6 * DEG);
    const kNeg = mfCall(-0.05, 6 * DEG);
    expect(aPos.gxAlpha).toBeCloseTo(aNeg.gxAlpha, 8);
    expect(kPos.gyKappa).toBeCloseTo(kNeg.gyKappa, 8);
  });
});

describe('evaluatePacejka56Combined — load sensitivity', () => {
  function peakFx(fz: number): number {
    let best = 0;
    for (let s = 0.005; s <= 0.5; s += 0.005) {
      const f = Math.abs(mfCall(s, 0, fz).fx);
      if (f > best) best = f;
    }
    return best;
  }
  function peakFy(fz: number): number {
    let best = 0;
    for (let deg = 0.25; deg <= 18; deg += 0.25) {
      const f = Math.abs(mfCall(0, deg * DEG, fz).fy);
      if (f > best) best = f;
    }
    return best;
  }

  it('peak Fx grows with Fz but the peak-Fx-per-newton ratio decreases', () => {
    const lo = peakFx(FZ_REF * 0.5);
    const ref = peakFx(FZ_REF);
    const hi = peakFx(FZ_REF * 1.5);
    expect(ref).toBeGreaterThan(lo);
    expect(hi).toBeGreaterThan(ref);
    // Sub-linear: peak-Fx / Fz drops as Fz grows because pDx2 < 0.
    expect(ref / FZ_REF).toBeLessThan(lo / (FZ_REF * 0.5));
    expect(hi / (FZ_REF * 1.5)).toBeLessThan(ref / FZ_REF);
  });

  it('peak Fy grows with Fz but the peak-Fy-per-newton ratio decreases', () => {
    const lo = peakFy(FZ_REF * 0.5);
    const ref = peakFy(FZ_REF);
    const hi = peakFy(FZ_REF * 1.5);
    expect(ref).toBeGreaterThan(lo);
    expect(hi).toBeGreaterThan(ref);
    expect(ref / FZ_REF).toBeLessThan(lo / (FZ_REF * 0.5));
    expect(hi / (FZ_REF * 1.5)).toBeLessThan(ref / FZ_REF);
  });

  it('dfz reflects the Fz - Fz0 deviation', () => {
    const r = mfCall(0.1, 0, FZ_REF * 1.5);
    expect(r.dfz).toBeCloseTo(0.5, 8);
  });
});

describe('evaluatePacejka56Combined — peak diagnostics', () => {
  it('reports a positive kappa peak that lines up with where pacejkaLong peaks', () => {
    const r = mfCall(0.1, 0);
    expect(r.kappaPeak).toBeGreaterThan(0);
    expect(r.kappaPeak).toBeLessThan(0.5);
    let bestSlip = 0;
    let best = -Infinity;
    for (let s = 0; s <= 0.4; s += 0.005) {
      const f = Math.abs(pacejkaLong(s, FZ_REF, 1));
      if (f > best) {
        best = f;
        bestSlip = s;
      }
    }
    expect(r.kappaPeak).toBeGreaterThan(bestSlip * 0.5);
    expect(r.kappaPeak).toBeLessThan(bestSlip * 2);
  });

  it('reports a positive alpha peak that lines up with where pacejkaLat peaks', () => {
    const r = mfCall(0, 6 * DEG);
    expect(r.alphaPeakRad).toBeGreaterThan(0);
    expect(r.alphaPeakRad).toBeLessThan(20 * DEG);
    let bestDeg = 0;
    let best = -Infinity;
    for (let deg = 0.5; deg <= 18; deg += 0.25) {
      const f = Math.abs(pacejkaLat(deg * DEG, FZ_REF, 1));
      if (f > best) {
        best = f;
        bestDeg = deg;
      }
    }
    const peakDeg = r.alphaPeakRad / DEG;
    expect(peakDeg).toBeGreaterThan(bestDeg * 0.5);
    expect(peakDeg).toBeLessThan(bestDeg * 2);
  });
});
