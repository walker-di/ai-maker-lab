/**
 * Anti-dive / anti-squat geometry. A real wishbone redirects part of the
 * longitudinal contact-patch force up through the suspension link rather than
 * through the spring. This resists pitch under braking and acceleration:
 *
 *   - Front wheel under brakes  (Fx < 0): anti-dive  pushes the front hub UP
 *   - Rear  wheel under throttle (Fx > 0): anti-squat pushes the rear hub UP
 *
 * The chassis still pitches, just less than pure spring deflection alone
 * would predict.
 *
 * Returns the additional vertical force to add to the contact-point reaction
 * (newtons). Under-driving / over-driving wheels (e.g. front under throttle)
 * contribute nothing, which mirrors a typical longitudinal-only geometry.
 */

export type Axle = 'front' | 'rear';

export interface AntiPitchInput {
  axle: Axle;
  fxAtContact: number;
  /** Anti-dive / anti-squat percentage (0..1). */
  pct: number;
}

export function computeAntiPitchVertical(input: AntiPitchInput): number {
  if (input.pct <= 0) return 0;
  if (input.axle === 'front' && input.fxAtContact < 0) {
    return -input.fxAtContact * input.pct;
  }
  if (input.axle === 'rear' && input.fxAtContact > 0) {
    return input.fxAtContact * input.pct;
  }
  return 0;
}
