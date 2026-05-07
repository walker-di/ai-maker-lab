/**
 * Gyroscopic torque from spinning wheels.
 *
 * High-speed spinning wheels carry angular momentum that resists changes in
 * wheel-plane orientation. When the front wheels are steered, the resulting
 * precession creates a roll torque about the chassis X axis. Pitch torque
 * from wheel gyroscopic effects is negligible for road cars and kept at zero.
 *
 * Pure functions; no Three.js / Jolt dependency.
 */

export interface GyroscopicTorqueInput {
  /** Wheel angular speed (rad/s). Positive = forward roll. */
  wheelOmega: number;
  /** Wheel + tire + brake disc rotational inertia (kg·m²). */
  wheelInertia: number;
  /** Steering rate of the wheel plane (rad/s). */
  steerRate: number;
}

export interface GyroscopicTorqueResult {
  /** Torque about the roll (X) axis in N·m. */
  torqueRollNm: number;
  /** Torque about the pitch (Y) axis in N·m. ≈0 for road cars. */
  torquePitchNm: number;
}

/**
 * Compute gyroscopic torque produced by a single spinning wheel.
 *
 * τ_x ≈ I_w · ω_w · steerRate
 * τ_y ≈ 0
 */
export function computeGyroscopicTorque({
  wheelOmega,
  wheelInertia,
  steerRate,
}: GyroscopicTorqueInput): GyroscopicTorqueResult {
  if (
    !Number.isFinite(wheelOmega) ||
    !Number.isFinite(wheelInertia) ||
    !Number.isFinite(steerRate)
  ) {
    return { torqueRollNm: 0, torquePitchNm: 0 };
  }

  // Roll torque from steering-induced precession.
  const torqueRollNm = wheelInertia * wheelOmega * steerRate;

  // Pitch torque from wheel gyroscopic effects is negligible for road cars.
  return { torqueRollNm, torquePitchNm: 0 };
}
