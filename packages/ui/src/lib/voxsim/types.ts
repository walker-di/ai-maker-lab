/**
 * Local UI types mirror for the voxsim experiment.
 *
 * `packages/ui` cannot depend on `packages/domain` (see `packages/ui/AGENTS.md`).
 * This file mirrors the structural shape declared in
 * `packages/domain/src/shared/voxsim/`. Domain types satisfy these structurally
 * when passed from the app layer, mirroring the chat and platformer rule.
 *
 * If you add or change a field in the shared domain, mirror it here in the
 * same change. Both files must stay structurally compatible.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface Transform {
  position: Vec3;
  rotation: Quat;
}

export type VoxelKind =
  | 'empty'
  | 'solid'
  | 'ramp'
  | 'hazard'
  | 'goal'
  | 'food'
  | 'water'
  | 'spawn';

export const VOXEL_KINDS: readonly VoxelKind[] = [
  'empty',
  'solid',
  'ramp',
  'hazard',
  'goal',
  'food',
  'water',
  'spawn',
] as const;

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
  id: string;
  chunkOrigin: ChunkOrigin;
  size: ChunkSize;
  voxels: Uint8Array;
}

export type EntityKind =
  | 'propBox'
  | 'foodPile'
  | 'hazardField'
  | 'goalMarker';

export type EntityParamValue = number | string | boolean;

export interface AgentSpawn {
  id: string;
  tag: string;
  pose: Transform;
  bodyDnaRef?: string;
  brainDnaRef?: string;
}

export interface EntitySpawn {
  id: string;
  kind: EntityKind;
  pose: Transform;
  params?: Readonly<Record<string, EntityParamValue>>;
}

export interface ChunkBounds {
  min: { cx: number; cy: number; cz: number };
  max: { cx: number; cy: number; cz: number };
}

export interface ArenaDefinition {
  id: string;
  version: number;
  chunkSize: ChunkSize;
  voxelSize: number;
  bounds: ChunkBounds;
  chunks: Chunk[];
  spawns: AgentSpawn[];
  entities: EntitySpawn[];
  gravity: Vec3;
  skybox: string;
}

export type ArenaSource = 'builtin' | 'user';

export interface ArenaMetadata {
  title: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  source: ArenaSource;
  inheritsFromBuiltInId?: string;
}

export const DEFAULT_GRAVITY: Vec3 = { x: 0, y: -9.81, z: 0 };
export const DEFAULT_VOXEL_SIZE = 1.0;
export const DEFAULT_CHUNK_SIZE: ChunkSize = { sx: 16, sy: 16, sz: 16 };

export function ordinalForVoxelKind(kind: VoxelKind): number {
  return VOXEL_KINDS.indexOf(kind);
}

export function voxelKindFromOrdinal(ordinal: number): VoxelKind | undefined {
  if (ordinal < 0 || ordinal >= VOXEL_KINDS.length) return undefined;
  return VOXEL_KINDS[ordinal];
}

export function voxelIndex(size: ChunkSize, x: number, y: number, z: number): number {
  return x + size.sx * (y + size.sy * z);
}
