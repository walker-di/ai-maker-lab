/**
 * Wheel-heading and slip-angle helpers used by the chassis integrator.
 *
 * Returned components are coefficients in the chassis basis, expressed as
 * (right, forward) where chassis right is the +x axis and chassis forward is
 * whichever world axis the engine has chosen for forward (Three.js convention
 * uses -z). Positive steer is a left turn, so the wheel-forward vector leans
 * toward -right (chassis left) while the wheel-lateral vector stays 90 degrees
 * to the right of the tire heading.
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

export function computeSlipAngleRad(vx: number, vy: number, minLongSpeed = 1.5): number {
  return -Math.atan2(vy, Math.max(Math.abs(vx), minLongSpeed));
}
