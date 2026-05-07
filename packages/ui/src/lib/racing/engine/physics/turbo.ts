/**
 * Turbocharger spool and boost model (M6).
 *
 * Models the compressor wheel spool-up dynamics, peak boost pressure,
 * wastegate/overboost protection, and the torque multiplier delivered to the
 * engine torque path.  This module is intentionally independent of Three.js,
 * Jolt, SurrealDB, and all browser/device APIs — it is pure numerical physics
 * that the engine orchestrator (`RacingEngine`) drives each step.
 *
 * Concepts:
 *   - `spoolRatio`  : normalised turbo shaft speed [0..1], 0 = at rest,
 *                     1 = at the design point where peak boost is delivered.
 *   - `boostBar`    : current gauge pressure produced by the compressor (bar
 *                     above ambient).  Follows the spool ratio via the
 *                     authored `peakBoostBar` ceiling.
 *   - `torqueMultiplier` : dimensionless factor ≥ 1.0 applied to the NA
 *                     engine torque curve so the drivetrain model naturally
 *                     benefits from forced induction.
 *   - `isOverboost`  : flag set when `boostBar` exceeds the authored
 *                     `overboostLimitBar`; the integrator may use this to
 *                     retard fuelling.
 *
 * Spool dynamics:
 *   The spool ratio changes each step proportional to:
 *     - Throttle × engine rpm (exhaust energy driving the turbine)
 *     - Minus friction/inertia decay
 *
 *   Two tunable time constants drive the ramp:
 *   `spoolUpTimeS`  : approximate time (seconds) for `spoolRatio` to travel
 *                     0 → 1 at full throttle at the target spool rpm.
 *   `spoolDownTimeS`: approximate time for `spoolRatio` to decay 1 → 0 after
 *                     lift-off (blow-off valve / inertia coast).
 */

/** Authored turbocharger parameters. All fields are optional; defaults
 *  give a mild single-scroll turbo typical of a 2-litre road car. */
export interface TurboParams {
  /**
   * Peak gauge boost pressure delivered at `spoolRatio = 1.0` (bar).
   * Default: 1.2 bar.
   */
  peakBoostBar?: number;
  /**
   * Overboost protection limit (bar). When `boostBar` exceeds this the
   * engine is considered in overboost (wastegate / ECU fuel-cut territory).
   * Default: `peakBoostBar * 1.15`.
   */
  overboostLimitBar?: number;
  /**
   * Torque multiplier at `boostBar = peakBoostBar`. The multiplier at
   * intermediate boost is linearly interpolated from 1.0 at 0 bar to this
   * value at `peakBoostBar`.  Default: 1.45 (stock turbo car typical).
   */
  peakTorqueMultiplier?: number;
  /**
   * Engine rpm at which the turbo produces maximum spool rate
   * (approximately `rpm_peak_torque`). Default: 3500 rpm.
   */
  targetSpoolRpm?: number;
  /**
   * Approximate seconds from 0 to full spool at WOT and `targetSpoolRpm`.
   * Default: 1.8 s.
   */
  spoolUpTimeS?: number;
  /**
   * Approximate seconds to decay from full spool to zero after throttle
   * lift-off (blow-off valve inertia coast). Default: 2.5 s.
   */
  spoolDownTimeS?: number;
  /**
   * Minimum spool ratio maintained at idle (prevents cold-start instant
   * boost on the first blip). Default: 0.0.
   */
  idleSpoolRatio?: number;
  /**
   * Boost efficiency scale in [0, 1] that can represent intercooler heat-
   * soak or altitude de-rating. Default: 1.0.
   */
  efficiencyScale?: number;
}

const DEFAULT_PEAK_BOOST_BAR = 1.2;
const DEFAULT_PEAK_TORQUE_MULTIPLIER = 1.45;
const DEFAULT_TARGET_SPOOL_RPM = 3500;
const DEFAULT_SPOOL_UP_TIME = 1.8;
const DEFAULT_SPOOL_DOWN_TIME = 2.5;
const DEFAULT_IDLE_SPOOL = 0.0;

/** Per-step turbo state that `RacingEngine` carries and passes in. */
export interface TurboState {
  /** Normalised compressor shaft speed [0..1]. */
  spoolRatio: number;
  /** Current gauge boost pressure (bar, ≥ 0). */
  boostBar: number;
  /** Torque multiplier delivered to the engine this step (≥ 1). */
  torqueMultiplier: number;
  /** True when boost exceeds `overboostLimitBar`. */
  isOverboost: boolean;
}

export function makeTurboState(): TurboState {
  return { spoolRatio: 0, boostBar: 0, torqueMultiplier: 1, isOverboost: false };
}

export interface TurboStepInput {
  /** Current turbo state (will be mutated in-place and returned). */
  state: TurboState;
  /** Effective throttle after TC cut [0..1]. */
  throttle: number;
  /** Current engine angular velocity (rad/s). */
  engineOmega: number;
  /** Simulation step duration (s). */
  dt: number;
  /** Authored turbo parameters. */
  params: TurboParams;
}

/**
 * Advance the turbo state by one simulation step.
 * Mutates `input.state` in-place and returns it.
 *
 * Algorithm:
 *   1. Convert `engineOmega` to rpm.
 *   2. Compute spool drive: `throttle × clamp(rpm / targetRpm, 0, 1.5)`.
 *      This creates the classic "boost builds faster at higher rpm" curve.
 *   3. On drive > current spool: ramp up at `1 / spoolUpTime × drive`.
 *      On drive < current spool: decay at `1 / spoolDownTime`.
 *   4. Clamp spool to `[idleSpool, 1]`.
 *   5. Compute `boostBar = spool² × peakBoostBar × efficiencyScale` (the
 *      quadratic gives a better spool–boost curve than linear).
 *   6. Derive `torqueMultiplier` from linear interpolation `1 → peakMult`
 *      as boost goes `0 → peakBoostBar`.
 *   7. Flag overboost.
 */
export function stepTurbo(input: TurboStepInput): TurboState {
  const { state, throttle, engineOmega, dt, params } = input;

  const peakBoost = params.peakBoostBar ?? DEFAULT_PEAK_BOOST_BAR;
  const overboostLimit = params.overboostLimitBar ?? peakBoost * 1.15;
  const peakMult = params.peakTorqueMultiplier ?? DEFAULT_PEAK_TORQUE_MULTIPLIER;
  const targetRpm = params.targetSpoolRpm ?? DEFAULT_TARGET_SPOOL_RPM;
  const tUp = Math.max(0.01, params.spoolUpTimeS ?? DEFAULT_SPOOL_UP_TIME);
  const tDown = Math.max(0.01, params.spoolDownTimeS ?? DEFAULT_SPOOL_DOWN_TIME);
  const idleSpool = Math.max(0, params.idleSpoolRatio ?? DEFAULT_IDLE_SPOOL);
  const efficiency = Math.max(0, Math.min(1, params.efficiencyScale ?? 1));

  const rpm = engineOmega * (60 / (2 * Math.PI));
  const rpmNorm = Math.max(0, Math.min(1.5, rpm / Math.max(1, targetRpm)));

  // Exhaust energy drive signal [0..1].
  const drive = throttle * rpmNorm;

  let spool = state.spoolRatio;

  if (drive > spool) {
    // Spool up: rate proportional to how much energy is available.
    const rate = drive / tUp;
    spool += rate * dt;
  } else {
    // Spool down / coast.
    const rate = 1 / tDown;
    spool -= rate * dt;
  }

  spool = Math.max(idleSpool, Math.min(1, spool));

  // Quadratic spool-to-boost: better midrange shape than linear.
  const boostBar = Math.max(0, spool * spool * peakBoost * efficiency);

  // Torque multiplier: linear from 1 at 0 bar to peakMult at peakBoostBar.
  const boostFrac = peakBoost > 0 ? Math.min(1, boostBar / peakBoost) : 0;
  const torqueMultiplier = 1 + (peakMult - 1) * boostFrac;

  const isOverboost = boostBar > overboostLimit;

  state.spoolRatio = spool;
  state.boostBar = boostBar;
  state.torqueMultiplier = torqueMultiplier;
  state.isOverboost = isOverboost;

  return state;
}
