/**
 * Wheel-heading and slip-angle helpers used by the chassis integrator.
 * Chassis axes are x=right, z=forward. Positive steer means a left turn, so
 * the wheel-forward vector leans toward -x while the wheel-lateral vector
 * stays 90 degrees to the right of the tire heading.
 */

export interface WheelHeadingBasis {
  /** Forward vector x-component in chassis space (+x = right). */
  forwardX: number;
  /** Forward vector z-component in chassis space (+z = forward). */
  forwardZ: number;
  /** Lateral vector x-component in chassis space (+x = right). */
  lateralX: number;
  /** Lateral vector z-component in chassis space (+z = forward). */
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
