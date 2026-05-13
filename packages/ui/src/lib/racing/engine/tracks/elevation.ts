/**
 * Elevation / height-field queries for the 3D track surface (M4).
 *
 * An `ElevationMap` stores a sparse set of authored height samples indexed
 * by centerline-segment index.  At query time the map interpolates linearly
 * between the two nearest authored samples; segments with no data return
 * `y = 0` so the flat-ground fallback is preserved for all existing tracks.
 *
 * A `HeightField` is the richer variant used when full terrain data is
 * available: it holds a regular 2-D grid that can be queried at any world
 * (x, z) coordinate.  Both types are pure-math — no Three.js / Jolt / DOM.
 *
 * Coordinate convention (matches the rest of the engine):
 *   +X = right, +Y = up, +Z = backward.
 */

/** One authored elevation key-frame along the centerline. */
export interface ElevationSample {
  /** Index into the sampled centerline array (0 … N−1). */
  segmentIndex: number;
  /** World-space height (m, +Y up). */
  y: number;
}

/**
 * Sparse elevation map keyed to centerline segments.
 * Segments not covered by any sample return `y = 0`.
 */
export class ElevationMap {
  private readonly sorted: ReadonlyArray<ElevationSample>;

  constructor(samples: ReadonlyArray<ElevationSample>) {
    this.sorted = [...samples].sort((a, b) => a.segmentIndex - b.segmentIndex);
  }

  /**
   * Ground height (m) for a position expressed as a fractional centerline
   * index.  `fracIndex` can be a non-integer; the map interpolates linearly
   * between the two bounding samples.
   */
  groundY(fracIndex: number): number {
    const s = this.sorted;
    if (s.length === 0) return 0;
    if (fracIndex <= s[0].segmentIndex) return s[0].y;
    if (fracIndex >= s[s.length - 1].segmentIndex) return s[s.length - 1].y;

    let lo = 0;
    let hi = s.length - 1;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (s[mid].segmentIndex <= fracIndex) lo = mid;
      else hi = mid;
    }
    const a = s[lo];
    const b = s[hi];
    const span = b.segmentIndex - a.segmentIndex;
    if (span < 1e-9) return a.y;
    const t = (fracIndex - a.segmentIndex) / span;
    return a.y + (b.y - a.y) * t;
  }
}

/**
 * Dense 2-D height grid sampled over a world-space bounding rectangle.
 * `cols x rows` height values are stored row-major (z-major).
 *
 * Bilinear interpolation is used for points that fall between grid cells.
 * Points outside the grid bounds return `fallbackY` (default 0).
 */
export interface HeightFieldParams {
  /** World-space origin corner (minimum x, minimum z of the grid). */
  originX: number;
  originZ: number;
  /** World-space extent of one cell in each dimension (metres). */
  cellSizeX: number;
  cellSizeZ: number;
  /** Number of columns (x-axis samples). */
  cols: number;
  /** Number of rows (z-axis samples). */
  rows: number;
  /**
   * Flat array of height values, length = cols x rows.
   * Index = row * cols + col, where row 0 is at originZ.
   */
  heights: ReadonlyArray<number>;
  /** Height returned for queries outside the grid (default: 0). */
  fallbackY?: number;
}

export class HeightField {
  private readonly p: HeightFieldParams;
  private readonly fallback: number;

  constructor(params: HeightFieldParams) {
    this.p = params;
    this.fallback = params.fallbackY ?? 0;
  }

  /** World-space ground height (m) at (x, z) via bilinear interpolation. */
  groundY(x: number, z: number): number {
    const { originX, originZ, cellSizeX, cellSizeZ, cols, rows, heights } = this.p;
    const fx = (x - originX) / cellSizeX;
    const fz = (z - originZ) / cellSizeZ;

    const col0 = Math.floor(fx);
    const row0 = Math.floor(fz);

    if (col0 < 0 || row0 < 0 || col0 >= cols - 1 || row0 >= rows - 1) {
      return this.fallback;
    }

    const tx = fx - col0;
    const tz = fz - row0;

    const h00 = heights[row0 * cols + col0];
    const h10 = heights[row0 * cols + (col0 + 1)];
    const h01 = heights[(row0 + 1) * cols + col0];
    const h11 = heights[(row0 + 1) * cols + (col0 + 1)];

    return (
      h00 * (1 - tx) * (1 - tz) +
      h10 * tx * (1 - tz) +
      h01 * (1 - tx) * tz +
      h11 * tx * tz
    );
  }

  /** Surface normal (unnormalized) at (x, z) via finite differences. */
  normalAt(x: number, z: number): { nx: number; ny: number; nz: number } {
    const eps = this.p.cellSizeX * 0.5;
    const epsZ = this.p.cellSizeZ * 0.5;
    const dydx = (this.groundY(x + eps, z) - this.groundY(x - eps, z)) / (2 * eps);
    const dydz = (this.groundY(x, z + epsZ) - this.groundY(x, z - epsZ)) / (2 * epsZ);
    return { nx: -dydx, ny: 1, nz: -dydz };
  }
}

/**
 * Unified ground-height resolver used by the engine raycast.
 * Priority: HeightField > ElevationMap > flat 0.
 */
export class TerrainContact {
  constructor(
    private readonly heightField: HeightField | null,
    private readonly elevationMap: ElevationMap | null,
  ) {}

  /**
   * Ground height for a wheel raycast at (worldX, worldZ).
   *
   * @param worldX    World x coordinate (m).
   * @param worldZ    World z coordinate (m).
   * @param fracIndex Fractional centerline index for ElevationMap fallback.
   */
  groundY(worldX: number, worldZ: number, fracIndex = 0): number {
    if (this.heightField) return this.heightField.groundY(worldX, worldZ);
    if (this.elevationMap) return this.elevationMap.groundY(fracIndex);
    return 0;
  }

  /** True when this instance carries no authored elevation data. */
  get isFlat(): boolean {
    return this.heightField === null && this.elevationMap === null;
  }
}
