/**
 * Ackermann steering geometry. Given the steering input (rad), wheelbase,
 * track, and ackermann percentage (0 = parallel, 1 = ideal Ackermann), this
 * returns the per-wheel steering angles for the inner and outer front wheels
 * such that both wheels point through the instantaneous turn centre.
 *
 * `leftRad` and `rightRad` are signed (left turn → positive left input).
 */

export interface AckermannPair {
  leftRad: number;
  rightRad: number;
  innerRad: number;
  outerRad: number;
}

export function computeAckermannAngles(
  steerCmdRad: number,
  wheelbaseM: number,
  trackM: number,
  ackermannPct = 1,
): AckermannPair {
  const absSteer = Math.abs(steerCmdRad);
  if (absSteer < 1e-6 || ackermannPct <= 0) {
    return {
      leftRad: steerCmdRad,
      rightRad: steerCmdRad,
      innerRad: absSteer,
      outerRad: absSteer,
    };
  }
  const sign = Math.sign(steerCmdRad) || 1;
  const outer = absSteer;
  const outerRadius = wheelbaseM / Math.max(Math.tan(outer), 1e-6);
  const innerIdeal = Math.atan(wheelbaseM / Math.max(0.25, outerRadius - trackM));
  const inner = outer + (innerIdeal - outer) * ackermannPct;
  const leftRad = sign > 0 ? inner : outer;
  const rightRad = sign > 0 ? outer : inner;
  return {
    leftRad: leftRad * sign,
    rightRad: rightRad * sign,
    innerRad: inner,
    outerRad: outer,
  };
}
