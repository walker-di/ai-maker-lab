import { describe, expect, test } from 'bun:test';

import {
  DEFAULT_CHUNK_SIZE,
  DEFAULT_GRAVITY,
  DEFAULT_VOXEL_SIZE,
  type ArenaDefinition,
} from './arena-types.js';
import { chunkIdFor, chunkVoxelCount, type Chunk, type ChunkOrigin } from './chunk-types.js';
import { identityQuat } from './vec.js';
import { validateArenaDefinition } from './validation.js';
import { ordinalForVoxelKind, VOXEL_KINDS } from './voxel-metadata.js';

function makeChunk(origin: ChunkOrigin, fillOrdinal = 0): Chunk {
  const voxels = new Uint8Array(chunkVoxelCount(DEFAULT_CHUNK_SIZE));
  voxels.fill(fillOrdinal);
  return {
    id: chunkIdFor(origin),
    chunkOrigin: origin,
    size: DEFAULT_CHUNK_SIZE,
    voxels,
  };
}

function makeArena(extra: Partial<ArenaDefinition> = {}): ArenaDefinition {
  return {
    id: 'test-arena',
    version: 1,
    chunkSize: DEFAULT_CHUNK_SIZE,
    voxelSize: DEFAULT_VOXEL_SIZE,
    bounds: {
      min: { cx: 0, cy: 0, cz: 0 },
      max: { cx: 1, cy: 0, cz: 1 },
    },
    chunks: [makeChunk({ cx: 0, cy: 0, cz: 0 })],
    spawns: [
      {
        id: 'spawn-1',
        tag: 'biped',
        pose: { position: { x: 1, y: 1, z: 1 }, rotation: identityQuat() },
      },
    ],
    entities: [],
    gravity: DEFAULT_GRAVITY,
    skybox: 'default',
    ...extra,
  };
}

describe('validateArenaDefinition', () => {
  test('accepts a minimal valid arena', () => {
    const result = validateArenaDefinition(makeArena());
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('reports chunk size mismatch', () => {
    const arena = makeArena({
      chunks: [
        {
          ...makeChunk({ cx: 0, cy: 0, cz: 0 }),
          size: { sx: 8, sy: 16, sz: 16 },
        },
      ],
    });
    const result = validateArenaDefinition(arena);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'chunk.size-mismatch')).toBe(true);
  });

  test('reports voxels-length mismatch', () => {
    const arena = makeArena({
      chunks: [
        {
          ...makeChunk({ cx: 0, cy: 0, cz: 0 }),
          voxels: new Uint8Array(10),
        },
      ],
    });
    const result = validateArenaDefinition(arena);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'chunk.voxels-length-mismatch')).toBe(true);
  });

  test('reports duplicate chunk ids', () => {
    const dup = makeChunk({ cx: 0, cy: 0, cz: 0 });
    const arena = makeArena({ chunks: [dup, { ...dup }] });
    const result = validateArenaDefinition(arena);
    expect(result.errors.some((e) => e.code === 'chunk.duplicate-id')).toBe(true);
  });

  test('reports invalid voxel ordinal', () => {
    const chunk = makeChunk({ cx: 0, cy: 0, cz: 0 });
    chunk.voxels[42] = 99; // out of VoxelKind range
    const arena = makeArena({ chunks: [chunk] });
    const result = validateArenaDefinition(arena);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'chunk.voxel-ordinal-invalid')).toBe(true);
  });

  test('reports spawn outside world bounds', () => {
    const arena = makeArena({
      spawns: [
        {
          id: 'spawn-1',
          tag: 'biped',
          pose: { position: { x: 9999, y: 0, z: 0 }, rotation: identityQuat() },
        },
      ],
    });
    const result = validateArenaDefinition(arena);
    expect(result.errors.some((e) => e.code === 'spawn.out-of-bounds')).toBe(true);
  });

  test('reports entity outside world bounds', () => {
    const arena = makeArena({
      entities: [
        {
          id: 'e-1',
          kind: 'foodPile',
          pose: { position: { x: -100, y: 0, z: 0 }, rotation: identityQuat() },
        },
      ],
    });
    const result = validateArenaDefinition(arena);
    expect(result.errors.some((e) => e.code === 'entity.out-of-bounds')).toBe(true);
  });

  test('reports chunk origin outside bounds', () => {
    const arena = makeArena({
      chunks: [makeChunk({ cx: 99, cy: 0, cz: 0 })],
    });
    const result = validateArenaDefinition(arena);
    expect(result.errors.some((e) => e.code === 'chunk.origin-out-of-bounds')).toBe(true);
  });

  test('reports empty spawns', () => {
    const arena = makeArena({ spawns: [] });
    const result = validateArenaDefinition(arena);
    expect(result.errors.some((e) => e.code === 'arena.no-spawns')).toBe(true);
  });

  test('accepts every voxel kind ordinal', () => {
    const chunk = makeChunk({ cx: 0, cy: 0, cz: 0 });
    for (let i = 0; i < VOXEL_KINDS.length && i < chunk.voxels.length; i++) {
      chunk.voxels[i] = ordinalForVoxelKind(VOXEL_KINDS[i]!);
    }
    const arena = makeArena({ chunks: [chunk] });
    const result = validateArenaDefinition(arena);
    expect(result.ok).toBe(true);
  });
});
