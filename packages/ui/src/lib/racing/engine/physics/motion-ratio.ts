/**
 * Suspension motion ratio. A real wishbone moves the spring/damper through
 * a leverage ratio relative to the wheel. Effective wheel-rate force scales
 * by motionRatio² because both the deflection and the lever arm shrink with
 * the ratio.
 */

export function computeMotionRatio(rawRate: number, motionRatio: number): number {
  return rawRate * motionRatio * motionRatio;
}
