/**
 * Pacejka "Magic Formula" tire force curves. Lateral force from slip angle,
 * longitudinal force from slip ratio. Both peak around the realistic
 * slip values for a sports/race tire and use the same load-sensitive peak
 * (`tireD`) so the friction-circle clamp downstream stays consistent.
 *
 * The lateral curve has an optional `fall` parameter that models post-peak
 * grip drop-off (a real tire doesn't grow lateral force forever past peak;
 * it slides instead).
 */

import { tireD } from './tire-load.js';

export function pacejkaLat(slipAngleRad: number, fz: number, mu: number, fall = 0): number {
  const alphaDeg = slipAngleRad * (180 / Math.PI);
  const B = 0.27;
  const C = 1.3;
  const D = tireD(mu, fz);
  const E = -1.6;
  const x = alphaDeg;
  let y = D * Math.sin(C * Math.atan(B * x - E * (B * x - Math.atan(B * x))));
  if (fall > 0) {
    const peakDeg = 7;
    const overshoot = Math.max(0, Math.abs(alphaDeg) - peakDeg);
    y *= 1 / (1 + fall * overshoot);
  }
  return y;
}

export function pacejkaLong(slipRatio: number, fz: number, mu: number): number {
  const B = 14;
  const C = 1.65;
  const D = tireD(mu, fz);
  const E = 0.97;
  const x = slipRatio;
  return D * Math.sin(C * Math.atan(B * x - E * (B * x - Math.atan(B * x))));
}
