/**
 * Voxel vocabulary used by every plan in the voxsim experiment.
 *
 * The ordinal of each value in `VOXEL_KINDS` is the byte stored in
 * `Chunk.voxels`. Do not reorder entries without bumping `ArenaDefinition.version`
 * and writing a migration; existing arena JSON depends on the ordering.
 */
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

export interface VoxelMetadata {
  /** Treated as a solid block by chunk colliders (plan 02). */
  readonly solid: boolean;
  /** Walkable surface for ground-contact sensors and pathfinding. */
  readonly walkable: boolean;
  /** Damages or kills overlapping bodies. */
  readonly lethal: boolean;
  /** Can be picked up or consumed by an entity (food, water). */
  readonly consumable: boolean;
  /** Triggers an event on overlap (goal, spawn). */
  readonly interactive: boolean;
}

const VOXEL_METADATA: Readonly<Record<VoxelKind, VoxelMetadata>> = {
  empty:  { solid: false, walkable: false, lethal: false, consumable: false, interactive: false },
  solid:  { solid: true,  walkable: true,  lethal: false, consumable: false, interactive: false },
  ramp:   { solid: true,  walkable: true,  lethal: false, consumable: false, interactive: false },
  hazard: { solid: true,  walkable: false, lethal: true,  consumable: false, interactive: false },
  goal:   { solid: false, walkable: false, lethal: false, consumable: false, interactive: true  },
  food:   { solid: false, walkable: false, lethal: false, consumable: true,  interactive: true  },
  water:  { solid: false, walkable: false, lethal: false, consumable: true,  interactive: false },
  spawn:  { solid: false, walkable: false, lethal: false, consumable: false, interactive: true  },
};

export function getVoxelMetadata(kind: VoxelKind): VoxelMetadata {
  return VOXEL_METADATA[kind];
}

export function isSolidVoxel(kind: VoxelKind): boolean {
  return VOXEL_METADATA[kind].solid;
}

export function voxelKindFromOrdinal(ordinal: number): VoxelKind | undefined {
  if (ordinal < 0 || ordinal >= VOXEL_KINDS.length) return undefined;
  return VOXEL_KINDS[ordinal];
}

export function ordinalForVoxelKind(kind: VoxelKind): number {
  return VOXEL_KINDS.indexOf(kind);
}

export function isValidVoxelOrdinal(ordinal: number): boolean {
  return Number.isInteger(ordinal) && ordinal >= 0 && ordinal < VOXEL_KINDS.length;
}
