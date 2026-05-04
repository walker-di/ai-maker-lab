/**
 * Wheel-heading and per-wheel kinematic helpers used by the chassis
 * integrator and the tire force model.
 *
 * # Chassis basis (input side)
 *
 * `computeWheelHeadingBasis` returns coefficients in the chassis basis,
 * expressed as `(right, forward)` where chassis right is the +x axis and
 * chassis forward is whichever world axis the engine has chosen for forward
 * (Three.js convention uses -z). Positive steer is a left turn, so the
 * wheel-forward vector leans toward -right (chassis left) while the
 * wheel-lateral vector stays 90 degrees to the right of the tire heading.
 *
 * # Project-local SAE-style wheel contact frame (output side)
 *
 * `computeWheelSlipTargets` operates in a documented per-wheel contact
 * frame. The chassis-side projection is performed by the engine before
 * calling the helper so this module stays free of any vector-library
 * dependency.
 *
 * - `+x` (longitudinal): wheel rolling direction, aligned with the
 *   steered/toed wheel heading. `vx > 0` means the contact patch moves
 *   forward through the tire frame.
 * - `+y` (lateral): wheel right, 90 degrees to the right of `+x` in the
 *   chassis ground plane. `vy > 0` means the contact patch slides toward
 *   wheel-right.
 * - `+z` (vertical): chassis up / contact-normal direction (not consumed
 *   by these helpers but documented here for the wider tire pipeline).
 * - `wheelSurfaceSpeed = wheelAngularSpeed * wheelRadius`: tire
 *   circumferential surface speed, positive when the tire is rolling
 *   forward through the wheel-local +x direction.
 *
 * The slip definitions returned by `computeWheelSlipTargets` are
 * INSTANTANEOUS targets. The engine feeds them into the relaxation-length
 * filter (`stepRelaxedSlip`) before sending them to the Pacejka model so
 * that the tire response carries a physically meaningful first-order lag
 * driven by contact-patch travel rather than wall-clock time.
 */

export interface WheelHeadingBasis {
  /** Coefficient on the chassis right axis for the wheel-forward vector. */
  forwardX: number;
  /** Coefficient on the chassis forward axis for the wheel-forward vector. */
  forwardZ: number;
  /** Coefficient on the chassis right axis for the wheel-lateral vector. */
  lateralX: number;
  /** Coefficient on the chassis forward axis for the wheel-lateral vector. */
  lateralZ: number;
}

export function computeWheelHeadingBasis(steerAngleRad: number): WheelHeadingBasis {
  const sin = Math.sin(steerAngleRad);
  const cos = Math.cos(steerAngleRad);
  return {
    forwardX: -sin,
    forwardZ: cos,
    lateralX: cos,
    lateralZ: sin,
  };
}

/**
 * Legacy slip-angle helper kept for backward compatibility with the older
 * `slipEps`-style low-speed clamp. The engine now uses
 * `computeWheelSlipTargets` instead, which removes the artificial
 * `1.5 m/s` denominator cliff. New code should not call this.
 *
 * @deprecated Prefer `computeWheelSlipTargets` for the engine pipeline.
 */
export function computeSlipAngleRad(vx: number, vy: number, minLongSpeed = 1.5): number {
  return -Math.atan2(vy, Math.max(Math.abs(vx), minLongSpeed));
}

export interface WheelSlipTargetInput {
  /** Contact-patch velocity along wheel +x (m/s). Positive = rolling forward. */
  longitudinalSpeed: number;
  /** Contact-patch velocity along wheel +y (m/s). Positive = sliding right. */
  lateralSpeed: number;
  /** Wheel angular velocity (rad/s). */
  wheelAngularSpeed: number;
  /** Loaded tire radius (m). */
  wheelRadius: number;
}

export interface WheelSlipTargets {
  /** Echo of the input longitudinal contact-patch speed. */
  longitudinalSpeed: number;
  /** Echo of the input lateral contact-patch speed. */
  lateralSpeed: number;
  /** `wheelAngularSpeed * wheelRadius` (m/s). */
  wheelSurfaceSpeed: number;
  /** `hypot(longitudinalSpeed, lateralSpeed)` for relaxation lag. */
  contactSpeed: number;
  /**
   * Slip ratio (dimensionless). `(omega*r - vx) / max(|vx|, |omega*r|)`,
   * which is symmetric, finite at standstill, and free of the artificial
   * `+ 1.5 m/s` denominator cliff used by the legacy formula.
   *
   * - Positive: drive (tire turning faster than the patch moves forward).
   * - Negative: braking or wheel locked (tire turning slower).
   */
  slipRatio: number;
  /**
   * Slip angle (rad). `-atan2(vy, max(|vx|, eps))` with a tiny numerical
   * floor only — no large low-speed under-reporting. Sign convention
   * matches the legacy helper: `vy > 0` produces a negative slip angle.
   */
  slipAngleRad: number;
}

/** Numerical floor for the atan2 denominator to avoid `0/0` at exact rest. */
const SLIP_ANGLE_NUMERICAL_EPS = 1e-3;
/** Standstill deadband: both speeds below this report 0 instead of 0/0. */
const SLIP_RATIO_STANDSTILL_EPS = 1e-3;

export function computeWheelSlipTargets(input: WheelSlipTargetInput): WheelSlipTargets {
  const wheelSurfaceSpeed = input.wheelAngularSpeed * input.wheelRadius;
  const contactSpeed = Math.hypot(input.longitudinalSpeed, input.lateralSpeed);

  const denom = Math.max(Math.abs(input.longitudinalSpeed), Math.abs(wheelSurfaceSpeed));
  const slipRatio =
    denom <= SLIP_RATIO_STANDSTILL_EPS
      ? 0
      : (wheelSurfaceSpeed - input.longitudinalSpeed) / denom;

  const slipAngleRaw = -Math.atan2(
    input.lateralSpeed,
    Math.max(Math.abs(input.longitudinalSpeed), SLIP_ANGLE_NUMERICAL_EPS),
  );
  // Normalise the IEEE-754 negative zero that `-atan2(0, eps)` returns at
  // standstill to a clean positive zero so downstream `=== 0` checks and
  // sign-only assertions don't trip on the negative bit.
  const slipAngleRad = slipAngleRaw === 0 ? 0 : slipAngleRaw;

  return {
    longitudinalSpeed: input.longitudinalSpeed,
    lateralSpeed: input.lateralSpeed,
    wheelSurfaceSpeed,
    contactSpeed,
    slipRatio,
    slipAngleRad,
  };
}
