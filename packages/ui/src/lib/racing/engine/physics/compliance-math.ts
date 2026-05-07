/**
 * Pure math helpers for chassis compliance.
 *
 * No Three.js / Jolt dependency — safe for domain-level tests.
 */

/** Default tire carcass radial stiffness (N/m). */
export const DEFAULT_TIRE_CARCASS_STIFFNESS_NPM = 200_000;

/**
 * Effective wheel rate as a series combination of tire carcass, bushing,
 * and suspension spring stiffness.
 *
 *   1/k_eff = 1/k_carcass + 1/k_bushing + 1/k_spring
 *
 * When bushing stiffness is 0 (rigid), it contributes 0 compliance and
 * k_eff = series(k_carcass, k_spring).  When both bushing and carcass
 * are rigid (0 and default), k_eff = k_spring — no regression.
 */
export function effectiveSeriesStiffness(
  kSpringNpm: number,
  kBushingNpm: number,
  kCarcassNpm: number = DEFAULT_TIRE_CARCASS_STIFFNESS_NPM,
): number {
  let inv = 0;
  if (kSpringNpm > 0) inv += 1 / kSpringNpm;
  if (kBushingNpm > 0) inv += 1 / kBushingNpm;
  if (kCarcassNpm > 0) inv += 1 / kCarcassNpm;
  return inv > 0 ? 1 / inv : 0;
}

/**
 * Natural frequency of a hub mass on the bushing spring (Hz).
 *
 *   f_n = (1 / 2π) * sqrt(k / m)
 */
export function hubNaturalFrequencyHz(kNpm: number, massKg: number): number {
  if (kNpm <= 0 || massKg <= 0) return 0;
  return (1 / (2 * Math.PI)) * Math.sqrt(kNpm / massKg);
}

/**
 * Critical damping coefficient for a hub (N·s/m).
 *
 *   c_crit = 2 * sqrt(k * m)
 */
export function hubCriticalDampingNspm(kNpm: number, massKg: number): number {
  if (kNpm <= 0 || massKg <= 0) return 0;
  return 2 * Math.sqrt(kNpm * massKg);
}

/**
 * Torsional restoring torque magnitude (N·m) for a given chassis roll.
 *
 *   τ = -k_torsion_rad * roll_rad
 *
 * The sign is negative (opposes roll).
 */
export function torsionalRestoringTorqueNm(
  rollRad: number,
  kTorsionNmDeg: number,
): number {
  const kRad = kTorsionNmDeg * (Math.PI / 180);
  return -kRad * rollRad;
}

/**
 * Chassis roll angle (rad) from the right-vector world-Y component.
 *
 *   roll = asin(-right.y)
 *
 * Bounds to [-π/2, π/2].
 */
export function chassisRollFromRightY(rightY: number): number {
  return Math.asin(Math.max(-1, Math.min(1, -rightY)));
}
