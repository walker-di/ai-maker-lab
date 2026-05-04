/**
 * Self-aligning moment (`Mz`). Pneumatic trail shifts the effective point of
 * application of the lateral force a small distance BEHIND the geometric
 * contact-patch centre (in the direction opposite to wheel motion). When the
 * orchestrator computes chassis yaw via `r × F` at the contact patch, that
 * over-counts the yaw moment by `trail · Fy_lat` — the correction added
 * here brings the chassis yaw back to its physically correct effective
 * lever arm.
 *
 * The trail collapses exponentially with slip-angle magnitude — at high
 * slip the contact patch is sliding and there's no asymmetric pressure
 * distribution any more, so the steering goes "light".
 *
 * Sign convention: returned value is added directly to chassis yaw torque
 * about `chassis.up`. Positive `fySlip` (force toward chassis +X) at a
 * front wheel forward of COM creates a *negative* yaw moment about
 * chassis.up (right turn) via `r × F` at the contact, so the trail
 * correction must SUBTRACT magnitude — i.e. share the same sign as the
 * direct yaw contribution. The simplest expression that achieves this is
 * `+trail * fySlip`, applied opposite to the over-counted contact-patch
 * `r × F` lever arm.
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
  return trail * fySlip;
}
