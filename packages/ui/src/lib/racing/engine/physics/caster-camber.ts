/**
 * Caster-induced camber. A real strut/wishbone with positive caster gains
 * negative camber on the outside wheel under steering input — this is one
 * of the mechanisms a real car uses to keep the contact patch flat through
 * a corner. We approximate it with a sin-of-steering term scaled by caster.
 */

const DEG = Math.PI / 180;

export function computeCasterCamber(steerRad: number, casterDeg: number): number {
  return -Math.abs(Math.sin(steerRad)) * (casterDeg * DEG) * 0.35;
}
