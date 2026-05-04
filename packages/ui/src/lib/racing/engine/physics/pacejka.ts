/**
 * Pacejka "Magic Formula" tire force model — MF 5.6 subset.
 *
 * Phase 2 of the racing physics rework replaced the old fixed-coefficient
 * curves + cosine attenuation + isotropic friction-circle clamp with a
 * parameterized evaluator that computes pure longitudinal and lateral forces
 * from per-axle MF parameters, applies dfz-based load sensitivity (so peak
 * force, slip stiffness, and curvature all scale with vertical load), and
 * weights the combined-slip output through smooth MF-style cosine functions
 * normalized so they equal `1` when the off-axis slip is zero.
 *
 * `evaluatePacejka56Combined` is the integration entry point used by
 * `RacingEngine`. The legacy `pacejkaLat` / `pacejkaLong` exports stay so
 * older callers and helper tests keep working during the migration; they
 * delegate to the new pure-slip helpers using the default front-axle params.
 */
import { tireD } from './tire-load.js';

export type Pacejka56Axle = 'front' | 'rear';

/**
 * Subset of the Pacejka MF 5.6 coefficient set. Horizontal / vertical shifts
 * and most asymmetry terms are intentionally omitted — they default to zero
 * inside the evaluator. This keeps the surface narrow while leaving room to
 * add SHy / SVy / sign asymmetries if a real .tir dataset gets wired in.
 */
export interface Pacejka56AxleParams {
  /** Reference vertical load Fz0 (N). dfz = (Fz - Fz0) / Fz0. */
  fz0: number;

  // ---- Pure longitudinal ----------------------------------------------
  /** C shape factor for Fx0 (~1.65 for sport tires). */
  pCx1: number;
  /** Peak coefficient at Fz0: Dx = (pDx1 + pDx2 * dfz) * muScale * Fz. */
  pDx1: number;
  pDx2: number;
  /** Slip stiffness coefficient: Kx = Fz * (pKx1 + pKx2 * dfz). */
  pKx1: number;
  pKx2: number;
  /** Curvature: Ex = (pEx1 + pEx2 * dfz). */
  pEx1: number;
  pEx2: number;

  // ---- Pure lateral ---------------------------------------------------
  /** C shape factor for Fy0 (~1.3 for sport tires). */
  pCy1: number;
  /** Peak coefficient at Fz0: Dy = (pDy1 + pDy2 * dfz) * muScale * Fz. */
  pDy1: number;
  pDy2: number;
  /**
   * Cornering stiffness coefficient. `Ky = pKy1 * Fz0 * sin(2 *
   * atan(Fz / (pKy2 * Fz0)))` — the MF saturating form, so Ky grows with
   * load but flattens at high Fz the way real tires do.
   */
  pKy1: number;
  pKy2: number;
  /** Curvature: Ey = (pEy1 + pEy2 * dfz). */
  pEy1: number;
  pEy2: number;

  // ---- Combined slip weighting ----------------------------------------
  /**
   * Gxa(alpha) = cos(rCx1 * atan(rBx1 * tan(alpha))). Reduces longitudinal
   * force as the tire develops slip angle. Equals 1 at alpha = 0.
   */
  rBx1: number;
  rCx1: number;
  /**
   * Gyk(kappa) = cos(rCy1 * atan(rBy1 * kappa)). Reduces lateral force as
   * the tire develops slip ratio. Equals 1 at kappa = 0.
   */
  rBy1: number;
  rCy1: number;
}

/**
 * Default sport / race tire coefficients. Tuned to keep the pure-slip peaks
 * and post-peak shape close to the previous fixed `B = 14, C = 1.65, E = 0.97`
 * longitudinal curve and `B = 0.27/deg, C = 1.3, E = -1.6` lateral curve, with
 * `pDx2 / pDy2 = -0.12` matching the old `TIRE_LOAD_FALLOFF` so per-axle Fz
 * behaves the same as before across the operating load range. Combined-slip
 * coefficients are deliberately gentler than a textbook `.tir` set —  the
 * integration tests downstream were calibrated around very weak combined-slip
 * coupling, so we land on a middle ground that smoothly attenuates without
 * over-killing grip in moderate-slip transients. Front and rear share the
 * same baseline; the type allows distinct front/rear when the vehicle preset
 * supplies overrides.
 */
export const DEFAULT_PACEJKA56_PARAMS: Pacejka56AxleParams = {
  fz0: 3500,

  pCx1: 1.65,
  pDx1: 1.0,
  pDx2: -0.12,
  pKx1: 25,
  pKx2: 0,
  pEx1: 0.95,
  pEx2: 0,

  pCy1: 1.3,
  pDy1: 1.0,
  pDy2: -0.12,
  pKy1: 22.5,
  pKy2: 1.5,
  pEy1: -1.4,
  pEy2: 0,

  rBx1: 2.5,
  rCx1: 1.0,
  rBy1: 2.5,
  rCy1: 1.0,
};

export const DEFAULT_PACEJKA56_FRONT: Pacejka56AxleParams = { ...DEFAULT_PACEJKA56_PARAMS };
export const DEFAULT_PACEJKA56_REAR: Pacejka56AxleParams = { ...DEFAULT_PACEJKA56_PARAMS };

export interface Pacejka56Input {
  /** Slip ratio, kappa = (omega * R - vx) / |vx|. Sign convention: + on drive. */
  kappa: number;
  /** Slip angle (rad). SAE convention: positive lateral velocity → negative alpha. */
  alphaRad: number;
  /** Per-wheel vertical load (N). Clamped at zero internally. */
  fz: number;
  /** Mu multiplier from surface and tire temperature (1.0 = nominal asphalt). */
  muScale: number;
  /** Selects default axle parameter set. */
  axle: Pacejka56Axle;
  /** Optional per-axle parameter overrides merged on top of the defaults. */
  params?: Partial<Pacejka56AxleParams>;
}

export interface Pacejka56Result {
  /** Combined-slip longitudinal force (N), in the SAE wheel-forward direction. */
  fx: number;
  /** Combined-slip lateral force (N), in the SAE wheel-lateral direction. */
  fy: number;
  /** Pure-slip longitudinal force at the same kappa (N). Diagnostic. */
  fxPure: number;
  /** Pure-slip lateral force at the same alpha (N). Diagnostic. */
  fyPure: number;
  /** Combined-slip Fx weight, cos(...) — equals 1 at alpha=0. */
  gxAlpha: number;
  /** Combined-slip Fy weight, cos(...) — equals 1 at kappa=0. */
  gyKappa: number;
  /** Normalized load deviation, dfz = (fz - fz0) / fz0. */
  dfz: number;
  /** Pure-slip peak slip ratio (numeric estimate). Diagnostic. */
  kappaPeak: number;
  /** Pure-slip peak slip angle (rad, numeric estimate). Diagnostic. */
  alphaPeakRad: number;
}

const ZERO_RESULT: Pacejka56Result = {
  fx: 0,
  fy: 0,
  fxPure: 0,
  fyPure: 0,
  gxAlpha: 1,
  gyKappa: 1,
  dfz: -1,
  kappaPeak: 0,
  alphaPeakRad: 0,
};

function mergeParams(axle: Pacejka56Axle, override?: Partial<Pacejka56AxleParams>): Pacejka56AxleParams {
  const base = axle === 'front' ? DEFAULT_PACEJKA56_FRONT : DEFAULT_PACEJKA56_REAR;
  if (!override) return base;
  return { ...base, ...override };
}

function magicFormula(x: number, B: number, C: number, D: number, E: number): number {
  if (D === 0) return 0;
  const Bx = B * x;
  const arg = Bx - E * (Bx - Math.atan(Bx));
  return D * Math.sin(C * Math.atan(arg));
}

/**
 * Solve for the slip value where the MF curve peaks numerically. Used only
 * as a diagnostic in the result so callers can build telemetry like
 * `kappa / kappaPeak` without re-implementing the math. Bisection on the
 * derivative would be overkill — at the operating ranges we care about, the
 * peak satisfies `C * atan(arg) ≈ π/2`, i.e. `arg ≈ tan(π/(2C))`. We invert
 * `arg(x) = B*x - E*(B*x - atan(B*x))` with a few Newton iterations.
 */
function estimatePeakSlip(B: number, C: number, E: number): number {
  if (B <= 0 || C <= 0) return 0;
  const target = Math.tan(Math.PI / (2 * C));
  // Start from the small-angle linear inversion arg ≈ B*x → x ≈ target / B.
  let x = target / B;
  for (let i = 0; i < 8; i++) {
    const Bx = B * x;
    const f = Bx - E * (Bx - Math.atan(Bx)) - target;
    const dArg = B - E * (B - B / (1 + Bx * Bx));
    if (Math.abs(dArg) < 1e-9) break;
    x -= f / dArg;
    if (!Number.isFinite(x)) return target / B;
  }
  return Math.abs(x);
}

interface PureLongitudinal {
  fx: number;
  Bx: number;
  Cx: number;
  Dx: number;
  Ex: number;
}

function evaluatePureLongitudinal(
  kappa: number,
  fz: number,
  muScale: number,
  p: Pacejka56AxleParams,
): PureLongitudinal {
  const dfz = (fz - p.fz0) / p.fz0;
  const Cx = p.pCx1;
  // Peak coefficient stays positive even at modest overload; clamp to keep
  // Dx >= 0 if a degenerate tuning produced negative coefficients.
  const muX = Math.max(0, p.pDx1 + p.pDx2 * dfz);
  const Dx = muScale * muX * fz;
  // Slip stiffness: Kx grows linearly with Fz at first; pKx2 is usually 0 for
  // sport tires so Kx/Fz stays roughly constant near the reference load.
  const Kx = fz * Math.max(0, p.pKx1 + p.pKx2 * dfz);
  const Bx = Cx * Dx > 0 ? Kx / (Cx * Dx) : 0;
  const Ex = p.pEx1 + p.pEx2 * dfz;
  const fx = magicFormula(kappa, Bx, Cx, Dx, Ex);
  return { fx, Bx, Cx, Dx, Ex };
}

interface PureLateral {
  fy: number;
  By: number;
  Cy: number;
  Dy: number;
  Ey: number;
}

function evaluatePureLateral(
  alphaRad: number,
  fz: number,
  muScale: number,
  p: Pacejka56AxleParams,
): PureLateral {
  const dfz = (fz - p.fz0) / p.fz0;
  const Cy = p.pCy1;
  const muY = Math.max(0, p.pDy1 + p.pDy2 * dfz);
  const Dy = muScale * muY * fz;
  // Cornering stiffness with the standard MF saturating form: Ky climbs with
  // Fz at low load and tails off near 2*pKy2*Fz0. pKy2 controls the knee.
  const denom = p.pKy2 * p.fz0;
  const Ky = denom > 0 ? p.pKy1 * p.fz0 * Math.sin(2 * Math.atan(fz / denom)) : 0;
  const By = Cy * Dy > 0 ? Ky / (Cy * Dy) : 0;
  const Ey = p.pEy1 + p.pEy2 * dfz;
  // SAE tire convention uses tan(alpha) inside the magic formula so the
  // input behaves linearly in the small-angle regime where Ky was derived.
  const fy = magicFormula(Math.tan(alphaRad), By, Cy, Dy, Ey);
  return { fy, By, Cy, Dy, Ey };
}

/**
 * Combined-slip evaluator. Returns Fx and Fy at the contact patch using
 * Pacejka MF 5.6-style cosine weighting:
 *
 *   Fx = Fx0(kappa) * cos(rCx1 * atan(rBx1 * tan(alpha)))
 *   Fy = Fy0(alpha) * cos(rCy1 * atan(rBy1 * kappa))
 *
 * The weights are normalized so they equal 1 at pure slip — there is no
 * arbitrary `0.35` floor. At extreme combined slip the weights decay smoothly
 * toward zero, which is what saturates the tire instead of an isotropic
 * friction-circle clamp downstream.
 */
export function evaluatePacejka56Combined(input: Pacejka56Input): Pacejka56Result {
  const fz = Math.max(0, input.fz);
  const muScale = Math.max(0, input.muScale);
  if (fz <= 0 || muScale <= 0) return { ...ZERO_RESULT };

  const params = mergeParams(input.axle, input.params);
  const pureLong = evaluatePureLongitudinal(input.kappa, fz, muScale, params);
  const pureLat = evaluatePureLateral(input.alphaRad, fz, muScale, params);

  const tanAlpha = Math.tan(input.alphaRad);
  const gxAlpha = Math.cos(params.rCx1 * Math.atan(params.rBx1 * tanAlpha));
  const gyKappa = Math.cos(params.rCy1 * Math.atan(params.rBy1 * input.kappa));

  const fx = pureLong.fx * gxAlpha;
  const fy = pureLat.fy * gyKappa;

  return {
    fx,
    fy,
    fxPure: pureLong.fx,
    fyPure: pureLat.fy,
    gxAlpha,
    gyKappa,
    dfz: (fz - params.fz0) / params.fz0,
    kappaPeak: estimatePeakSlip(pureLong.Bx, pureLong.Cx, pureLong.Ex),
    alphaPeakRad: Math.atan(estimatePeakSlip(pureLat.By, pureLat.Cy, pureLat.Ey)),
  };
}

/**
 * Legacy lateral wrapper — kept so older helper code paths and unit tests
 * keep compiling during the Phase 2 migration. Uses the default front-axle
 * MF parameters and ignores the post-peak `fall` heuristic, which is now
 * baked into the load- and curvature-aware MF curve. New code should call
 * `evaluatePacejka56Combined` instead.
 */
export function pacejkaLat(slipAngleRad: number, fz: number, mu: number, _fall = 0): number {
  if (fz <= 0 || mu <= 0) return 0;
  return evaluatePureLateral(slipAngleRad, fz, mu, DEFAULT_PACEJKA56_PARAMS).fy;
}

/**
 * Legacy longitudinal wrapper — see `pacejkaLat`. Returns the pure-slip
 * Fx using default coefficients. Combined-slip weighting is no longer
 * applied here; callers that need it should use `evaluatePacejka56Combined`.
 */
export function pacejkaLong(slipRatio: number, fz: number, mu: number): number {
  if (fz <= 0 || mu <= 0) return 0;
  const long = evaluatePureLongitudinal(slipRatio, fz, mu, DEFAULT_PACEJKA56_PARAMS);
  return long.fx;
}

// Re-export `tireD` so older tests that imported it directly continue to
// work; new tire force code must not call it for force saturation because
// load sensitivity now lives inside the Pacejka 5.6 D term.
export { tireD };
