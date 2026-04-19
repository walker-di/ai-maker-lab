/**
 * Chunk shape used by both the renderer (instanced cube meshes) and the
 * physics layer (chunk-baked colliders, plan 02). One chunk is one cube of
 * voxels; an arena is a sparse list of chunks indexed by integer chunk-space
 * coordinates.
 */

export interface ChunkOrigin {
  cx: number;
  cy: number;
  cz: number;
}

export interface ChunkSize {
  sx: number;
  sy: number;
  sz: number;
}

export interface Chunk {
  /** Deterministic id derived from `chunkOrigin`; see `chunkIdFor`. */
  id: string;
  chunkOrigin: ChunkOrigin;
  size: ChunkSize;
  /**
   * Length must equal `size.sx * size.sy * size.sz`. Indexed as
   * `x + size.sx * (y + size.sy * z)`. Each byte is a `VoxelKind` ordinal.
   */
  voxels: Uint8Array;
}

/** Derive a deterministic chunk id from its origin coordinates. */
export function chunkIdFor(origin: ChunkOrigin): string {
  return `chunk:${origin.cx}_${origin.cy}_${origin.cz}`;
}

/** Index a 3D coordinate inside a chunk into its `voxels` byte. */
export function voxelIndex(size: ChunkSize, x: number, y: number, z: number): number {
  return x + size.sx * (y + size.sy * z);
}

/** Total voxel byte count for a chunk with the given dimensions. */
export function chunkVoxelCount(size: ChunkSize): number {
  return size.sx * size.sy * size.sz;
}
