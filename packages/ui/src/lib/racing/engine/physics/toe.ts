/**
 * Toe slip-angle offset. Toe-in on the front axle adds an inward slip angle
 * (more grip on turn-in) and toe-in on the rear adds outward slip (more
 * straight-line stability). The sign convention here mirrors the prototype.
 */

const DEG = Math.PI / 180;

export type Axle = 'front' | 'rear';

export function computeToeSlipOffset(
  toeDeg: number,
  lateralSign: 1 | -1 = 1,
  axle: Axle = 'front',
): number {
  const direction = axle === 'rear' ? -1 : 1;
  return toeDeg * lateralSign * direction * DEG;
}
