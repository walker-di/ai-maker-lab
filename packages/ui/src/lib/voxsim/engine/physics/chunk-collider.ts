import type { Chunk, VoxelKind } from '../../types.js';
import { isSolidVoxelKind } from './voxel-helpers.js';
import type { ShapeSpec } from './types.js';

/**
 * Translates a voxel `Chunk` into a Jolt-ready `ShapeSpec` using a documented
 * decision matrix. The output is a pure-data spec; `JoltSystem` materialises
 * the actual Jolt `Shape` from it.
 *
 * Decision matrix (in order):
 *   1. Heightfield: every solid column has a contiguous run from the chunk
 *      floor up to some max-y. Produces `heightField`.
 *   2. Dense (`solidRatio >= 0.5`): produces `mesh` with surface-only faces
 *      (interior faces culled against in-chunk neighbors; chunk-edge faces
 *      always emitted because cross-chunk culling is reserved for a future
 *      iteration).
 *   3. Sparse (under `boxCap`, default 1024): produces `compound` of `box`
 *      children, one per solid voxel.
 *   4. Sparse but above `boxCap`: falls back to `mesh`.
 */

export interface ChunkColliderBuilderOptions {
  voxelSize: number;
  /** Soft limit for compound box children; above this the builder falls back to mesh. */
  boxCap?: number;
  /** Override the dense threshold. Defaults to 0.5. */
  denseRatio?: number;
}

export interface ChunkColliderResult {
  shape: ShapeSpec;
  chosenKind: 'mesh' | 'heightField' | 'compound';
  /** Position of the chunk in world space (lower-back-left corner). */
  worldOrigin: { x: number; y: number; z: number };
  /** Total non-empty solid voxels considered. */
  solidVoxelCount: number;
}

const DEFAULT_BOX_CAP = 1024;
const DEFAULT_DENSE_RATIO = 0.5;

export class ChunkColliderBuilder {
  private readonly voxelSize: number;
  private readonly boxCap: number;
  private readonly denseRatio: number;

  constructor(options: ChunkColliderBuilderOptions) {
    this.voxelSize = options.voxelSize;
    this.boxCap = options.boxCap ?? DEFAULT_BOX_CAP;
    this.denseRatio = options.denseRatio ?? DEFAULT_DENSE_RATIO;
  }

  build(chunk: Chunk): ChunkColliderResult | null {
    const totalVoxels = chunk.size.sx * chunk.size.sy * chunk.size.sz;
    const solidCount = countSolidVoxels(chunk);
    if (solidCount === 0) return null;

    const worldOrigin = chunkWorldOrigin(chunk, this.voxelSize);
    const ratio = solidCount / totalVoxels;

    // Decision matrix per `02-jolt-physics-boundary.md` step 6:
    //   1. dense (>= denseRatio) → surface mesh
    //   2. heightfield-shaped terrain → height field
    //   3. sparse and ≤ boxCap → compound of boxes
    //   4. sparse but > boxCap → fall back to surface mesh
    if (ratio >= this.denseRatio) {
      return {
        shape: buildSurfaceMeshShape(chunk, this.voxelSize),
        chosenKind: 'mesh',
        worldOrigin,
        solidVoxelCount: solidCount,
      };
    }

    if (isHeightfieldShape(chunk)) {
      return {
        shape: buildHeightFieldShape(chunk, this.voxelSize),
        chosenKind: 'heightField',
        worldOrigin,
        solidVoxelCount: solidCount,
      };
    }

    if (solidCount <= this.boxCap) {
      return {
        shape: buildCompoundBoxShape(chunk, this.voxelSize),
        chosenKind: 'compound',
        worldOrigin,
        solidVoxelCount: solidCount,
      };
    }

    return {
      shape: buildSurfaceMeshShape(chunk, this.voxelSize),
      chosenKind: 'mesh',
      worldOrigin,
      solidVoxelCount: solidCount,
    };
  }
}

// -----------------------------------------------------------------------------
// Helpers (exported for tests)
// -----------------------------------------------------------------------------

function chunkWorldOrigin(chunk: Chunk, voxelSize: number): { x: number; y: number; z: number } {
  return {
    x: chunk.chunkOrigin.cx * chunk.size.sx * voxelSize,
    y: chunk.chunkOrigin.cy * chunk.size.sy * voxelSize,
    z: chunk.chunkOrigin.cz * chunk.size.sz * voxelSize,
  };
}

function voxelAt(chunk: Chunk, x: number, y: number, z: number): VoxelKind | undefined {
  if (
    x < 0 || y < 0 || z < 0 ||
    x >= chunk.size.sx || y >= chunk.size.sy || z >= chunk.size.sz
  ) {
    return undefined;
  }
  const idx = x + chunk.size.sx * (y + chunk.size.sy * z);
  return ordinalToKind(chunk.voxels[idx]!);
}

function ordinalToKind(ord: number): VoxelKind | undefined {
  // Local copy so this file does not depend on the shared mirror's helper at
  // import-evaluation time. Mirrors `voxelKindFromOrdinal` from `types.ts`.
  const KINDS: VoxelKind[] = [
    'empty', 'solid', 'ramp', 'hazard',
    'goal', 'food', 'water', 'spawn',
  ];
  return KINDS[ord];
}

export function countSolidVoxels(chunk: Chunk): number {
  let count = 0;
  for (let i = 0; i < chunk.voxels.length; i++) {
    const k = ordinalToKind(chunk.voxels[i]!);
    if (k && isSolidVoxelKind(k)) count++;
  }
  return count;
}

/**
 * A chunk is heightfield-shaped when every (x, z) column is either fully
 * empty or has a contiguous run of solid voxels starting at y = 0 with empty
 * space above. Floating blocks disqualify the column. This is the cheap path
 * for terrain chunks and produces zero interior box children.
 */
export function isHeightfieldShape(chunk: Chunk): boolean {
  const { sx, sy, sz } = chunk.size;
  for (let z = 0; z < sz; z++) {
    for (let x = 0; x < sx; x++) {
      // Solid run from y=0 upward.
      let h = 0;
      while (h < sy) {
        const k = voxelAt(chunk, x, h, z);
        if (!k || !isSolidVoxelKind(k)) break;
        h++;
      }
      // Above h, every voxel must be empty.
      for (let y = h; y < sy; y++) {
        const k = voxelAt(chunk, x, y, z);
        if (k && isSolidVoxelKind(k)) return false;
      }
    }
  }
  return true;
}

export function buildHeightFieldShape(chunk: Chunk, voxelSize: number): ShapeSpec {
  const { sx, sy, sz } = chunk.size;
  const samples = new Float32Array(sx * sz);
  for (let z = 0; z < sz; z++) {
    for (let x = 0; x < sx; x++) {
      let topY = 0;
      for (let y = sy - 1; y >= 0; y--) {
        const k = voxelAt(chunk, x, y, z);
        if (k && isSolidVoxelKind(k)) {
          topY = (y + 1) * voxelSize;
          break;
        }
      }
      samples[x + sx * z] = topY;
    }
  }
  return {
    kind: 'heightField',
    samples,
    columns: sx,
    rows: sz,
    spacingXz: voxelSize,
  };
}

export function buildCompoundBoxShape(chunk: Chunk, voxelSize: number): ShapeSpec {
  const half = voxelSize * 0.5;
  const { sx, sy, sz } = chunk.size;
  const children: { shape: ShapeSpec; transform: import('../../types.js').Transform }[] = [];
  for (let z = 0; z < sz; z++) {
    for (let y = 0; y < sy; y++) {
      for (let x = 0; x < sx; x++) {
        const k = voxelAt(chunk, x, y, z);
        if (!k || !isSolidVoxelKind(k)) continue;
        children.push({
          shape: { kind: 'box', halfExtents: { x: half, y: half, z: half } },
          transform: {
            position: {
              x: x * voxelSize + half,
              y: y * voxelSize + half,
              z: z * voxelSize + half,
            },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
          },
        });
      }
    }
  }
  return { kind: 'compound', children };
}

/**
 * Build a triangle mesh from the chunk's surface faces. Interior faces (those
 * whose neighbor inside the same chunk is also solid) are culled. Chunk-edge
 * faces are always emitted because cross-chunk neighbor lookup is reserved
 * for a future iteration.
 */
export function buildSurfaceMeshShape(chunk: Chunk, voxelSize: number): ShapeSpec {
  const verts: number[] = [];
  const tris: number[] = [];
  const { sx, sy, sz } = chunk.size;
  const s = voxelSize;
  for (let z = 0; z < sz; z++) {
    for (let y = 0; y < sy; y++) {
      for (let x = 0; x < sx; x++) {
        const here = voxelAt(chunk, x, y, z);
        if (!here || !isSolidVoxelKind(here)) continue;

        // For each of the 6 faces, emit a quad if the neighbor is empty,
        // out-of-chunk (treated as empty for v1), or non-solid.
        if (faceShouldEmit(chunk, x - 1, y, z)) emitFace(verts, tris, x, y, z, s, '-x');
        if (faceShouldEmit(chunk, x + 1, y, z)) emitFace(verts, tris, x, y, z, s, '+x');
        if (faceShouldEmit(chunk, x, y - 1, z)) emitFace(verts, tris, x, y, z, s, '-y');
        if (faceShouldEmit(chunk, x, y + 1, z)) emitFace(verts, tris, x, y, z, s, '+y');
        if (faceShouldEmit(chunk, x, y, z - 1)) emitFace(verts, tris, x, y, z, s, '-z');
        if (faceShouldEmit(chunk, x, y, z + 1)) emitFace(verts, tris, x, y, z, s, '+z');
      }
    }
  }
  return {
    kind: 'mesh',
    vertices: new Float32Array(verts),
    indices: new Uint32Array(tris),
  };
}

function faceShouldEmit(chunk: Chunk, x: number, y: number, z: number): boolean {
  const k = voxelAt(chunk, x, y, z);
  if (k === undefined) return true; // chunk-edge: always emit
  return !isSolidVoxelKind(k);
}

type FaceDir = '+x' | '-x' | '+y' | '-y' | '+z' | '-z';

function emitFace(
  verts: number[],
  tris: number[],
  x: number,
  y: number,
  z: number,
  s: number,
  dir: FaceDir,
): void {
  const baseIndex = verts.length / 3;
  const x0 = x * s, x1 = (x + 1) * s;
  const y0 = y * s, y1 = (y + 1) * s;
  const z0 = z * s, z1 = (z + 1) * s;

  // Counter-clockwise winding from outside the cube for each face.
  const v: [number, number, number][] = (() => {
    switch (dir) {
      case '+x': return [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]];
      case '-x': return [[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0]];
      case '+y': return [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]];
      case '-y': return [[x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0]];
      case '+z': return [[x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [x0, y0, z1]];
      case '-z': return [[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]];
    }
  })();
  for (const [vx, vy, vz] of v) verts.push(vx, vy, vz);
  tris.push(baseIndex, baseIndex + 1, baseIndex + 2);
  tris.push(baseIndex, baseIndex + 2, baseIndex + 3);
}
