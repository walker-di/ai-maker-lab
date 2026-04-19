/**
 * Tiny seeded PRNG (Mulberry32) shared by every NEAT/evolution operator. The
 * UI package has its own copy of the same algorithm in
 * `packages/ui/src/lib/voxsim/brain/prng.ts`; both are byte-identical so a
 * worker and the trainer agree on every random draw for a given seed.
 */

export interface SeededPrng {
  next(): number;
  nextGaussian(): number;
  nextRange(min: number, max: number): number;
  nextInt(maxExclusive: number): number;
}

export function createMulberry32(seed: number): SeededPrng {
  let s = (seed | 0) >>> 0;
  let cached: number | null = null;

  function next(): number {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function nextGaussian(): number {
    if (cached !== null) {
      const v = cached;
      cached = null;
      return v;
    }
    let u = 0;
    let v = 0;
    while (u === 0) u = next();
    while (v === 0) v = next();
    const r = Math.sqrt(-2 * Math.log(u));
    cached = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  }

  function nextRange(min: number, max: number): number {
    return min + (max - min) * next();
  }

  function nextInt(maxExclusive: number): number {
    return Math.floor(next() * maxExclusive);
  }

  return { next, nextGaussian, nextRange, nextInt };
}
