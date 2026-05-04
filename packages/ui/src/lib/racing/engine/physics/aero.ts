/**
 * Aerodynamics. Three contributions:
 *   1. **Drag**, which grows quadratically with speed and includes a
 *      yaw-dependent term so a sliding car loses more speed than a tracking
 *      one.
 *   2. **Yaw-restoring moment**, which steers the chassis back toward its
 *      heading at high speed. This is the air pushing on the back-half of
 *      the car when the chassis is angled to the airflow.
 *   3. **Downforce**, per axle, scaled with airspeed squared. The renderer
 *      adds the result to per-wheel `Fz` BEFORE the tire model so high-speed
 *      corners get the expected grip boost. The plan calls for the matching
 *      reaction on the chassis to be applied separately so aero downforce
 *      cannot levitate the rigid body through a vertical-force artifact.
 *
 * Pure functions only; no dependence on Three.js. The renderer-side glue is
 * responsible for projecting velocity onto chassis-local axes and applying
 * the resulting force/moment to the rigid body.
 */

export interface AeroDragInput {
  /** Forward speed component along chassis +Z (m/s). */
  forwardSpeed: number;
  /** Lateral speed component along chassis +X (m/s). */
  sideSpeed: number;
  /** Drag coefficient · area (`0.5 ρ Cd A` is folded in). */
  cdArea: number;
  /** Air density × half (`0.5 ρ`). Default `0.6125` at sea level. */
  rhoHalf?: number;
  /** Extra drag coefficient applied to the lateral component. Default 1.6. */
  yawDragGain?: number;
}

export interface AeroDragResult {
  /** Drag force along the negative chassis +Z (N), always non-positive. */
  fzDragWS: number;
  /** Lateral drag along chassis +X (N), opposes the side velocity. */
  fxDragWS: number;
}

export function computeAeroDrag(input: AeroDragInput): AeroDragResult {
  const rho2 = input.rhoHalf ?? 0.6125;
  const yawGain = input.yawDragGain ?? 1.6;
  const v2 = Math.hypot(input.forwardSpeed, input.sideSpeed);
  const vSq = v2 * v2;
  if (v2 < 1e-3) return { fzDragWS: 0, fxDragWS: 0 };
  // Quadratic drag direction opposes total velocity.
  const fwd = input.forwardSpeed === 0
    ? 0
    : -Math.sign(input.forwardSpeed) * rho2 * input.cdArea * vSq * Math.abs(input.forwardSpeed) / v2;
  const lat = input.sideSpeed === 0
    ? 0
    : -Math.sign(input.sideSpeed) * rho2 * input.cdArea * yawGain * vSq * Math.abs(input.sideSpeed) / v2;
  return { fzDragWS: fwd, fxDragWS: lat };
}

export interface YawRestoringInput {
  /** Chassis-local sideslip angle in radians (positive = nose right). */
  sideslipRad: number;
  /** Air speed (m/s). */
  speed: number;
  /** Yaw-aero coefficient (≈ 0.10 for a sport sedan). */
  cyYaw?: number;
}

/** Yaw-restoring moment magnitude (positive = restores nose toward airflow). */
export function computeYawRestoringMoment({
  sideslipRad,
  speed,
  cyYaw = 0.1,
}: YawRestoringInput): number {
  // Moment scales with speed² (dynamic pressure) and with sin(sideslip),
  // saturating beyond ~30°.
  const s = Math.max(-1, Math.min(1, Math.sin(sideslipRad)));
  return -cyYaw * speed * speed * s;
}

export interface AeroDownforceInput {
  /**
   * Chassis-local longitudinal speed (m/s). Sign is irrelevant — wings and
   * splitters generate downward load whether the car is rolling forward or
   * backward — so the helper takes the magnitude.
   */
  forwardSpeed: number;
  /** Effective `Cl · A` for the front axle (m²). Negative inputs clamp to 0. */
  clAreaFront: number;
  /** Effective `Cl · A` for the rear axle (m²). Negative inputs clamp to 0. */
  clAreaRear: number;
  /** Air density. Default `1.225 kg/m³` at sea level, 15 °C. */
  airDensity?: number;
}

export interface AeroDownforceResult {
  /** Total downward load on the front axle (N). Always >= 0. */
  frontDownforceN: number;
  /** Total downward load on the rear axle (N). Always >= 0. */
  rearDownforceN: number;
}

/**
 * Per-axle aerodynamic downforce.
 *
 * Returns the totals for each axle; callers are expected to split the value
 * across the two wheels (typically 50/50 unless an asymmetric wing is being
 * modelled, which is out of scope for Phase 4).
 */
export function computeAeroDownforce(input: AeroDownforceInput): AeroDownforceResult {
  const rho = input.airDensity ?? 1.225;
  const v = Math.abs(input.forwardSpeed);
  if (!Number.isFinite(v) || v <= 0 || !Number.isFinite(rho) || rho <= 0) {
    return { frontDownforceN: 0, rearDownforceN: 0 };
  }
  const q = 0.5 * rho * v * v;
  const clFront = Number.isFinite(input.clAreaFront) ? Math.max(0, input.clAreaFront) : 0;
  const clRear = Number.isFinite(input.clAreaRear) ? Math.max(0, input.clAreaRear) : 0;
  return {
    frontDownforceN: q * clFront,
    rearDownforceN: q * clRear,
  };
}
