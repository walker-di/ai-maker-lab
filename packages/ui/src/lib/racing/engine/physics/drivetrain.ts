/**
 * Drivetrain components: slipping clutch and rear differential dispatch.
 *
 * **Slipping clutch**: the engine has its own rotational inertia. The clutch
 * transmits torque proportional to the speed difference between the engine
 * and the wheels-times-ratio, capped at a maximum clutch torque. This gives
 * meaningful drive torque from a standstill without locking engine speed to
 * wheel speed.
 *
 * **Differentials**:
 *   - `welded`: spool. Both rear wheels are forced to share the average omega.
 *   - `open`: no axle coupling. Wheels are independent.
 *   - `clutchLSD`: velocity-coupled clutch pack with separate power/coast
 *     lock and preload. Strong Δω + high drive torque pulls both wheels
 *     toward the axle average.
 *
 * All helpers are pure: they take in numerical state and return new numerical
 * state. The orchestrator updates the wheel state from the return value.
 */

export interface ClutchTorqueInput {
  engineOmega: number;
  /** Average driven wheel omega multiplied by the active gear ratio. */
  wheelEngineOmega: number;
  clutchStiffness: number;
  clutchMaxTorque: number;
}

export interface ClutchTorqueResult {
  clutchTorque: number;
  slip: number;
}

export function computeClutchTorque(input: ClutchTorqueInput): ClutchTorqueResult {
  const slip = input.engineOmega - input.wheelEngineOmega;
  const requested = input.clutchStiffness * slip;
  const clutchTorque = Math.max(
    -input.clutchMaxTorque,
    Math.min(input.clutchMaxTorque, requested),
  );
  return { clutchTorque, slip };
}

export type DiffType = 'welded' | 'open' | 'clutchLSD';

export interface DiffStepInput {
  type: DiffType;
  leftOmega: number;
  rightOmega: number;
  leftInertia: number;
  /** Throttle pedal value (0..1). LSD splits power vs coast lock by this. */
  effectiveThrottle: number;
  /** Average drive torque applied to the rear axle this step (Nm). */
  driveTorquePerWheel: number;
  preloadNm: number;
  capacityNm: number;
  powerLockPct: number;
  coastLockPct: number;
  dt: number;
}

export interface DiffStepResult {
  leftOmega: number;
  rightOmega: number;
}

export function applyDiffCoupling(input: DiffStepInput): DiffStepResult {
  const { leftOmega, rightOmega, type, dt } = input;
  switch (type) {
    case 'open':
      return { leftOmega, rightOmega };
    case 'welded': {
      const avg = (leftOmega + rightOmega) * 0.5;
      return { leftOmega: avg, rightOmega: avg };
    }
    case 'clutchLSD': {
      const onPower = input.effectiveThrottle > 0.05;
      const lockPct = onPower ? input.powerLockPct : input.coastLockPct;
      const driveMag = Math.abs(input.driveTorquePerWheel) * 2;
      const couplingMax = Math.min(input.capacityNm, input.preloadNm + lockPct * driveMag);
      const dOmega = leftOmega - rightOmega;
      const blend = Math.max(
        0,
        Math.min(1, (couplingMax * dt) / (input.leftInertia * Math.max(1, Math.abs(dOmega)))),
      );
      const avg = (leftOmega + rightOmega) * 0.5;
      return {
        leftOmega: leftOmega + (avg - leftOmega) * blend,
        rightOmega: rightOmega + (avg - rightOmega) * blend,
      };
    }
  }
}

export interface EngineStepInput {
  engineOmega: number;
  engineDriveTorque: number;
  /** Engine internal drag (pumping + friction), already with pumping fade. */
  engineDragTorque: number;
  clutchTorque: number;
  engineInertia: number;
  /** Idle governor floor (rad/s). */
  idleOmega: number;
  /** Hard rev limiter (rad/s). */
  redlineOmega: number;
  dt: number;
}

export function stepEngineOmega(input: EngineStepInput): number {
  const dragSign = Math.sign(input.engineOmega) || 1;
  const netT = input.engineDriveTorque - dragSign * input.engineDragTorque - input.clutchTorque;
  let omega = input.engineOmega + (netT / input.engineInertia) * input.dt;
  if (omega < input.idleOmega) omega = input.idleOmega;
  if (omega > input.redlineOmega) omega = input.redlineOmega;
  return omega;
}
