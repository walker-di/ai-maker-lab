/**
 * Self-aligning moment (`Mz`). Pneumatic and caster-derived mechanical trail
 * shift the effective point of application of lateral force behind the
 * contact-patch centre. Scrub radius contributes a smaller moment from the
 * longitudinal force acting away from the steering axis.
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
 * thrust, longitudinal force before rolling resistance, and steering geometry.
 */

const RAD = Math.PI / 180;
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export interface AligningMomentInput {
  slipAngleRad: number;
  /** Slip-driven lateral force (after combined-slip Gyk, before camber thrust). */
  fySlip: number;
  /** Longitudinal tire force before rolling resistance. */
  fx: number;
  /** Runtime setup caster. Mechanical trail is derived from this. */
  casterDeg: number;
  /** Pneumatic trail at zero slip (metres). Default 0.042. */
  pneumaticTrail0M?: number;
  /** Slip angle (deg) where pneumatic trail decays to 1/e. Default 15°. */
  pneumaticTrailDecayDeg?: number;
  /** Mechanical trail generated per degree of caster. Default 0.006 m/deg. */
  casterTrailScaleMPerDeg?: number;
  /** Cap for caster-derived mechanical trail. Default 0.065 m. */
  mechanicalTrailMaxM?: number;
  /** Effective scrub radius (metres). Default 0.015. */
  scrubRadiusM?: number;
  /** Side/sign multiplier for scrub torque. Defaults to +1 for standalone math. */
  scrubSign?: -1 | 1;
}

export interface AligningMomentResult {
  pneumaticTrailM: number;
  mechanicalTrailM: number;
  scrubRadiusM: number;
  pneumaticMz: number;
  mechanicalMz: number;
  scrubMz: number;
  mz: number;
}

export interface MzInput {
  slipAngleRad: number;
  /** Slip-driven lateral force (after combined-slip Gyk, before camber thrust). */
  fySlip: number;
  /** Pneumatic trail at zero slip (metres). Default 0.042. */
  trail0?: number;
  /** Slip angle (deg) where trail decays to 1/e. Default 15°. */
  decayDeg?: number;
}

export function computeAligningMoment({
  slipAngleRad,
  fySlip,
  fx,
  casterDeg,
  pneumaticTrail0M = 0.042,
  pneumaticTrailDecayDeg = 15,
  casterTrailScaleMPerDeg = 0.006,
  mechanicalTrailMaxM = 0.065,
  scrubRadiusM = 0.015,
  scrubSign = 1,
}: AligningMomentInput): AligningMomentResult {
  const decayRad = Math.max(0.001, pneumaticTrailDecayDeg * RAD);
  const pneumaticTrailM = pneumaticTrail0M * Math.exp(-Math.abs(slipAngleRad) / decayRad);
  const mechanicalTrailM = clamp(casterDeg * casterTrailScaleMPerDeg, 0, mechanicalTrailMaxM);
  const pneumaticMz = pneumaticTrailM * fySlip;
  const mechanicalMz = mechanicalTrailM * fySlip;
  const scrubMz = scrubSign * scrubRadiusM * fx;
  return {
    pneumaticTrailM,
    mechanicalTrailM,
    scrubRadiusM,
    pneumaticMz,
    mechanicalMz,
    scrubMz,
    mz: pneumaticMz + mechanicalMz + scrubMz,
  };
}

export function computeSelfAligningMoment({
  slipAngleRad,
  fySlip,
  trail0 = 0.042,
  decayDeg = 15,
}: MzInput): number {
  return computeAligningMoment({
    slipAngleRad,
    fySlip,
    fx: 0,
    casterDeg: 0,
    pneumaticTrail0M: trail0,
    pneumaticTrailDecayDeg: decayDeg,
    casterTrailScaleMPerDeg: 0,
    mechanicalTrailMaxM: 0,
    scrubRadiusM: 0,
  }).mz;
}
