const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export interface LowSpeedWheelLockInput {
  vx: number;
  omega: number;
  radius: number;
  driveTorqueNm: number;
  brakeTorqueNm: number;
  lockSpeedMps?: number;
  blendSpeedMps?: number;
  driveUnlockTorqueNm?: number;
  brakeLockTorqueNm?: number;
}

export interface LowSpeedWheelLockResult {
  omega: number;
  locked: boolean;
  blend: number;
}

/**
 * Keeps wheel angular velocity tied to contact-patch speed near standstill.
 * This prevents tiny slip-ratio errors from growing into forward/backward
 * chatter while still unlocking quickly for real launch torque.
 */
export function applyLowSpeedWheelRotationLock({
  vx,
  omega,
  radius,
  driveTorqueNm,
  brakeTorqueNm,
  lockSpeedMps = 0.4,
  blendSpeedMps = 0.8,
  driveUnlockTorqueNm = 35,
  brakeLockTorqueNm = 50,
}: LowSpeedWheelLockInput): LowSpeedWheelLockResult {
  const absVx = Math.abs(vx);
  if (radius <= 0 || absVx >= blendSpeedMps || Math.abs(driveTorqueNm) > driveUnlockTorqueNm) {
    return { omega, locked: false, blend: 0 };
  }

  const blendRange = Math.max(0.001, blendSpeedMps - lockSpeedMps);
  const blend = absVx <= lockSpeedMps
    ? 1
    : clamp((blendSpeedMps - absVx) / blendRange, 0, 1);
  if (blend <= 0) return { omega, locked: false, blend: 0 };

  const brakeLocked = brakeTorqueNm > brakeLockTorqueNm;
  const targetOmega = brakeLocked ? 0 : vx / radius;
  const nextOmega = omega + (targetOmega - omega) * blend;
  const chatterDeadband = 0.02;
  return {
    omega: Math.abs(nextOmega) < chatterDeadband ? 0 : nextOmega,
    locked: true,
    blend,
  };
}
