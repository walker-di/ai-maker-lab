/**
 * Deterministic RNG (xoshiro128+ derived from the spec). Mirrors the domain
 * implementation so AI/runtime helpers don't need to import from
 * `packages/domain`.
 */
export class SeededRng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: number) {
    let s = (seed | 0) || 1;
    this.a = s;
    this.b = (s = Math.imul(s ^ (s >>> 15), 0x735a2d97));
    this.c = (s = Math.imul(s ^ (s >>> 13), 0xc2b2ae3d));
    this.d = (s ^= s >>> 16) >>> 0;
  }

  static fromString(input: string, salt = 0): SeededRng {
    let h = 0x811c9dc5 ^ (salt | 0);
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return new SeededRng((h | 0) || 1);
  }

  nextU32(): number {
    const t = (this.b << 9) >>> 0;
    let r = (this.a + this.d) >>> 0;
    r = (Math.imul(r, 5) + 0x9e3779b1) >>> 0;
    this.c ^= this.a;
    this.d ^= this.b;
    this.b ^= this.c;
    this.a ^= this.d;
    this.c = (this.c ^ t) >>> 0;
    this.d = ((this.d << 11) | (this.d >>> 21)) >>> 0;
    return r;
  }

  float(): number {
    return this.nextU32() / 0x100000000;
  }

  int(min: number, max: number): number {
    return min + Math.floor(this.float() * (max - min + 1));
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.float() * items.length)]!;
  }

  chance(probability: number): boolean {
    return this.float() < probability;
  }

  fork(label: string): SeededRng {
    const next = SeededRng.fromString(label, this.nextU32());
    return next;
  }
}
