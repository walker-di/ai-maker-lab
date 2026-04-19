import type { VoxelKind } from '../../types.js';

/**
 * Mirrors `isSolidVoxel` from `packages/domain/src/shared/voxsim/voxel-metadata.ts`.
 * Kept local so the engine doesn't need to import the domain module.
 */
const SOLID_KINDS: ReadonlySet<VoxelKind> = new Set<VoxelKind>(['solid', 'ramp', 'hazard']);

export function isSolidVoxelKind(kind: VoxelKind): boolean {
  return SOLID_KINDS.has(kind);
}
