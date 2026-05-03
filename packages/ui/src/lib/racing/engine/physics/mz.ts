/**
 * Self-aligning moment (`Mz`). Pneumatic trail puts the lateral force point of
 * application a small distance behind the contact patch centre, producing a
 * yaw torque about the kingpin / chassis vertical. The trail collapses
 * exponentially with slip-angle magnitude — at high slip the contact patch
 * is sliding and there's no asymmetric pressure distribution any more, so
 * the steering goes "light".
 *
 * Pure function: takes the slip angle, the slip-driven Fy *before* camber
 * thrust, and an optional pneumatic-trail magnitude.
 */

const RAD = Math.PI / 180;

export interface MzInput {
  slipAngleRad: number;
  /** Slip-driven lateral force (after combined-slip Gyk, before camber thrust). */
  fySlip: number;
  /** Pneumatic trail at zero slip (metres). Default 0.042. */
  trail0?: number;
  /** Slip angle (deg) where trail decays to 1/e. Default 15°. */
  decayDeg?: number;
}

export function computeSelfAligningMoment({
  slipAngleRad,
  fySlip,
  trail0 = 0.042,
  decayDeg = 15,
}: MzInput): number {
  const decayRad = decayDeg * RAD;
  const trail = trail0 * Math.exp(-Math.abs(slipAngleRad) / decayRad);
  return -trail * fySlip;
}
