import type { Chunk, ChunkSize } from './chunk-types.js';
import type { AgentSpawn, EntitySpawn } from './entity-types.js';
import type { Vec3 } from './vec.js';

/** Chunk-space bounding box. Inclusive on both ends. */
export interface ChunkBounds {
  min: { cx: number; cy: number; cz: number };
  max: { cx: number; cy: number; cz: number };
}

export interface ArenaDefinition {
  id: string;
  /** Schema version. Bump when changing any persisted field shape. */
  version: number;
  /** Shared by every chunk in the arena. */
  chunkSize: ChunkSize;
  /** World units per voxel. */
  voxelSize: number;
  bounds: ChunkBounds;
  /** Sparse list. Missing chunks are treated as fully `empty`. */
  chunks: Chunk[];
  spawns: AgentSpawn[];
  entities: EntitySpawn[];
  gravity: Vec3;
  /** Reference to a bundled skybox id resolved by the asset registry. */
  skybox: string;
}

export type ArenaSource = 'builtin' | 'user';

export interface ArenaMetadata {
  title: string;
  author: string;
  /** ISO timestamp. */
  createdAt: string;
  /** ISO timestamp. */
  updatedAt: string;
  source: ArenaSource;
  inheritsFromBuiltInId?: string;
}

export const DEFAULT_GRAVITY: Vec3 = { x: 0, y: -9.81, z: 0 };
export const DEFAULT_VOXEL_SIZE = 1.0;
export const DEFAULT_CHUNK_SIZE: ChunkSize = { sx: 16, sy: 16, sz: 16 };
