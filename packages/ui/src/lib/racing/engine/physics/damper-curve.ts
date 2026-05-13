/**
 * Multi-knee damper force model.
 *
 * Real performance dampers have distinct bump/rebound force curves for
 * low-speed shaft velocities (LSB/LSR, handling transients) and high-speed
 * shaft velocities (HSB/HSR, kerb and bump absorption). The knee is the
 * shaft velocity at which the rate changes. This module computes the net
 * damper force from a pair of piecewise-linear segments on each side.
 *
 * Convention:
 *   - Positive `velocity` → compression (bump).
 *   - Negative `velocity` → extension (rebound).
 *   - Returned force is SIGNED and should be added directly to the spring
 *     force along the suspension axis (positive = pushing wheel away from
 *     chassis, i.e. resisting compression).
 *
 * Stable defaults:
 *   LSB = 4200 N·s/m, HSB = 2200 N·s/m, kneeB = 0.08 m/s
 *   LSR = 5800 N·s/m, HSR = 3000 N·s/m, kneeR = 0.08 m/s
 * These match the flat `cBump`/`cRebound` values already used in
 * `RacingEngine.ts` at zero damper velocity, so older presets that omit
 * the table fall through to identical behaviour.
 */

export interface DamperKneeParams {
  /** Low-speed bump coefficient (N·s/m). */
  lsb: number;
  /** High-speed bump coefficient (N·s/m). */
  hsb: number;
  /** Shaft velocity knee for bump (m/s). Must be > 0. */
  kneeB: number;
  /** Low-speed rebound coefficient (N·s/m). */
  lsr: number;
  /** High-speed rebound coefficient (N·s/m). */
  hsr: number;
  /** Shaft velocity knee for rebound (m/s). Must be > 0. */
  kneeR: number;
}

export const DEFAULT_DAMPER_KNEE_PARAMS: Readonly<DamperKneeParams> = {
  lsb: 4200,
  hsb: 2200,
  kneeB: 0.08,
  lsr: 5800,
  hsr: 3000,
  kneeR: 0.08,
};

export const DEFAULT_DAMPER_KNEE_PARAMS_REAR: Readonly<DamperKneeParams> = {
  lsb: 4400,
  hsb: 2400,
  kneeB: 0.08,
  lsr: 6000,
  hsr: 3200,
  kneeR: 0.08,
};

/**
 * Compute signed damper force for a given shaft velocity.
 *
 * @param velocity  Compression-positive shaft velocity (m/s) AFTER the
 *                  motion-ratio transform has been applied (i.e. the value
 *                  stored in `WheelState.damperVelocity`).
 * @param params    Knee-curve coefficients. Falls back to defaults when
 *                  `undefined` so callers can pass `undefined` for legacy
 *                  preset compatibility.
 * @returns         Signed force (N). Positive resists compression; negative
 *                  resists extension.
 */
export function computeDamperForce(
  velocity: number,
  params: DamperKneeParams | undefined,
): number {
  const p = params ?? DEFAULT_DAMPER_KNEE_PARAMS;

  if (velocity >= 0) {
    // Bump side.
    const knee = Math.max(1e-6, p.kneeB);
    if (velocity <= knee) {
      return p.lsb * velocity;
    }
    const kneeForce = p.lsb * knee;
    return kneeForce + p.hsb * (velocity - knee);
  } else {
    // Rebound side (velocity < 0).
    const v = -velocity;
    const knee = Math.max(1e-6, p.kneeR);
    if (v <= knee) {
      return -(p.lsr * v);
    }
    const kneeForce = p.lsr * knee;
    return -(kneeForce + p.hsr * (v - knee));
  }
}

/**
 * Force at the damper knee on the bump side (used for monotonicity checks).
 * Exposed for tests.
 */
export function bumKneeForce(params: DamperKneeParams): number {
  return params.lsb * params.kneeB;
}

/**
 * Force at the damper knee on the rebound side (used for monotonicity checks).
 * Exposed for tests.
 */
export function reboundKneeForce(params: DamperKneeParams): number {
  return params.lsr * params.kneeR;
}
