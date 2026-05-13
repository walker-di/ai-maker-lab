/**
 * Deterministic seeded RNG used by both the AI controllers and the map
 * generator. Implementation is a 32-bit xorshift to keep the state small and
 * the math fast.
 */
export class SeededRng {
  private state: number;
  private readonly seed: number;

  constructor(seed: number) {
    // Force unsigned 32-bit and avoid the zero state.
    this.seed = seed | 0;
    this.state = (seed | 0) || 0x9e3779b1;
  }

  static fromString(label: string, parentSeed: number): SeededRng {
    return new SeededRng(hashSeed(parentSeed, label));
  }

  fork(label: string): SeededRng {
    return new SeededRng(hashSeed(this.seed, `${label}:${this.state}`));
  }

  /** Returns a 32-bit unsigned int. */
  nextU32(): number {
    let x = this.state | 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x | 0;
    return x >>> 0;
  }

  /** Returns a float in [0, 1). */
  float(): number {
    return this.nextU32() / 0x100000000;
  }

  /** Returns an integer in [min, max). */
  int(min: number, max: number): number {
    if (max <= min) return min;
    return min + Math.floor(this.float() * (max - min));
  }

  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('SeededRng.pick requires a non-empty array');
    return arr[this.int(0, arr.length)] as T;
  }

  chance(p: number): boolean {
    return this.float() < p;
  }
}

function hashSeed(parentSeed: number, label: string): number {
  let h = (parentSeed | 0) ^ 0x811c9dc5;
  for (let i = 0; i < label.length; i++) {
    h ^= label.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h | 0) || 1;
}
