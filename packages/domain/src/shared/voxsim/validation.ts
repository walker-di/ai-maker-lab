import type { ArenaDefinition } from './arena-types.js';
import { chunkVoxelCount } from './chunk-types.js';
import type { Vec3 } from './vec.js';
import { isValidVoxelOrdinal } from './voxel-metadata.js';

export interface ArenaValidationIssue {
  code: string;
  message: string;
  chunkId?: string;
  voxelIndex?: number;
}

export interface ArenaValidationResult {
  ok: boolean;
  errors: ArenaValidationIssue[];
  warnings: ArenaValidationIssue[];
}

interface WorldBounds {
  min: Vec3;
  max: Vec3;
}

function worldBoundsOf(arena: ArenaDefinition): WorldBounds {
  const span = arena.voxelSize;
  const { sx, sy, sz } = arena.chunkSize;
  return {
    min: {
      x: arena.bounds.min.cx * sx * span,
      y: arena.bounds.min.cy * sy * span,
      z: arena.bounds.min.cz * sz * span,
    },
    max: {
      x: (arena.bounds.max.cx + 1) * sx * span,
      y: (arena.bounds.max.cy + 1) * sy * span,
      z: (arena.bounds.max.cz + 1) * sz * span,
    },
  };
}

function pointInWorld(p: Vec3, bounds: WorldBounds): boolean {
  return (
    p.x >= bounds.min.x && p.x <= bounds.max.x &&
    p.y >= bounds.min.y && p.y <= bounds.max.y &&
    p.z >= bounds.min.z && p.z <= bounds.max.z
  );
}

function chunkOriginInBounds(
  origin: { cx: number; cy: number; cz: number },
  bounds: ArenaDefinition['bounds'],
): boolean {
  return (
    origin.cx >= bounds.min.cx && origin.cx <= bounds.max.cx &&
    origin.cy >= bounds.min.cy && origin.cy <= bounds.max.cy &&
    origin.cz >= bounds.min.cz && origin.cz <= bounds.max.cz
  );
}

export function validateArenaDefinition(arena: ArenaDefinition): ArenaValidationResult {
  const errors: ArenaValidationIssue[] = [];
  const warnings: ArenaValidationIssue[] = [];

  const seenChunkIds = new Set<string>();
  const expectedVoxelCount = chunkVoxelCount(arena.chunkSize);

  for (const chunk of arena.chunks) {
    if (seenChunkIds.has(chunk.id)) {
      errors.push({
        code: 'chunk.duplicate-id',
        message: `Duplicate chunk id ${chunk.id}.`,
        chunkId: chunk.id,
      });
    }
    seenChunkIds.add(chunk.id);

    if (
      chunk.size.sx !== arena.chunkSize.sx ||
      chunk.size.sy !== arena.chunkSize.sy ||
      chunk.size.sz !== arena.chunkSize.sz
    ) {
      errors.push({
        code: 'chunk.size-mismatch',
        message: `Chunk ${chunk.id} size (${chunk.size.sx}x${chunk.size.sy}x${chunk.size.sz}) does not match arena chunkSize (${arena.chunkSize.sx}x${arena.chunkSize.sy}x${arena.chunkSize.sz}).`,
        chunkId: chunk.id,
      });
    }

    if (chunk.voxels.length !== expectedVoxelCount) {
      errors.push({
        code: 'chunk.voxels-length-mismatch',
        message: `Chunk ${chunk.id} voxels length ${chunk.voxels.length} does not match expected ${expectedVoxelCount}.`,
        chunkId: chunk.id,
      });
    }

    if (!chunkOriginInBounds(chunk.chunkOrigin, arena.bounds)) {
      errors.push({
        code: 'chunk.origin-out-of-bounds',
        message: `Chunk ${chunk.id} origin (${chunk.chunkOrigin.cx}, ${chunk.chunkOrigin.cy}, ${chunk.chunkOrigin.cz}) is outside arena bounds.`,
        chunkId: chunk.id,
      });
    }

    for (let i = 0; i < chunk.voxels.length; i++) {
      const ord = chunk.voxels[i]!;
      if (!isValidVoxelOrdinal(ord)) {
        errors.push({
          code: 'chunk.voxel-ordinal-invalid',
          message: `Chunk ${chunk.id} voxel index ${i} ordinal ${ord} is not a valid VoxelKind.`,
          chunkId: chunk.id,
          voxelIndex: i,
        });
        break;
      }
    }
  }

  const world = worldBoundsOf(arena);

  if (arena.spawns.length === 0) {
    errors.push({
      code: 'arena.no-spawns',
      message: 'Arena must declare at least one agent spawn.',
    });
  }

  for (const spawn of arena.spawns) {
    if (!pointInWorld(spawn.pose.position, world)) {
      errors.push({
        code: 'spawn.out-of-bounds',
        message: `Agent spawn ${spawn.id} position (${spawn.pose.position.x}, ${spawn.pose.position.y}, ${spawn.pose.position.z}) is outside the world bounding box.`,
      });
    }
  }

  for (const entity of arena.entities) {
    if (!pointInWorld(entity.pose.position, world)) {
      errors.push({
        code: 'entity.out-of-bounds',
        message: `Entity ${entity.id} (${entity.kind}) position (${entity.pose.position.x}, ${entity.pose.position.y}, ${entity.pose.position.z}) is outside the world bounding box.`,
      });
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
