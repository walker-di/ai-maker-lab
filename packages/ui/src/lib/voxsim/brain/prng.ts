/**
 * Tiny seeded PRNG used to make weight initialization byte-identical across
 * browsers and worker processes. Mulberry32 was chosen for compactness and
 * reproducibility; it is not cryptographically strong by design.
 */

export interface SeededPrng {
  next(): number;
  /** Standard Normal sample via Box-Muller. */
  nextGaussian(): number;
}

export function createMulberry32(seed: number): SeededPrng {
  let state = seed | 0;
  let pendingGaussian: number | null = null;
  return {
    next(): number {
      state = (state + 0x6d2b79f5) | 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    nextGaussian(): number {
      if (pendingGaussian !== null) {
        const v = pendingGaussian;
        pendingGaussian = null;
        return v;
      }
      let u1 = 0;
      let u2 = 0;
      while (u1 === 0) u1 = this.next();
      while (u2 === 0) u2 = this.next();
      const mag = Math.sqrt(-2.0 * Math.log(u1));
      const phase = 2.0 * Math.PI * u2;
      pendingGaussian = mag * Math.sin(phase);
      return mag * Math.cos(phase);
    },
  };
}
