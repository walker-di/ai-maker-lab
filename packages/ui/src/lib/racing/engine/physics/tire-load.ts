/**
 * Tire vertical-load helper. Real tire peak grip degrades non-linearly with
 * vertical load: doubling the load less than doubles the peak force the
 * contact patch can transmit. We capture that with a small linear falloff
 * around a reference load (`TIRE_FZ_REF`).
 *
 * Returns the peak Pacejka `D` term (newtons) as a function of friction
 * coefficient `mu` and vertical load `fz`.
 */

export const TIRE_FZ_REF = 3500;       // reference vertical load (N)
export const TIRE_LOAD_FALLOFF = 0.12;  // 0.10..0.15 typical for street/sport tires

export function tireD(mu: number, fz: number): number {
  return mu * fz * (1 - TIRE_LOAD_FALLOFF * (fz / TIRE_FZ_REF - 1));
}
