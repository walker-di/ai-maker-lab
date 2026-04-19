import { describe, expect, test } from 'bun:test';

import {
  ChunkColliderBuilder,
  buildCompoundBoxShape,
  buildHeightFieldShape,
  buildSurfaceMeshShape,
  countSolidVoxels,
  isHeightfieldShape,
} from './chunk-collider.js';
import type { Chunk } from '../../types.js';
import { ordinalForVoxelKind } from '../../types.js';

const SOLID = ordinalForVoxelKind('solid');
const EMPTY = ordinalForVoxelKind('empty');

function makeChunk(sx: number, sy: number, sz: number, fill: (x: number, y: number, z: number) => number): Chunk {
  const voxels = new Uint8Array(sx * sy * sz);
  for (let z = 0; z < sz; z++) {
    for (let y = 0; y < sy; y++) {
      for (let x = 0; x < sx; x++) {
        voxels[x + sx * (y + sy * z)] = fill(x, y, z);
      }
    }
  }
  return { id: 'c0', chunkOrigin: { cx: 0, cy: 0, cz: 0 }, size: { sx, sy, sz }, voxels };
}

describe('countSolidVoxels', () => {
  test('counts only voxels marked solid', () => {
    const chunk = makeChunk(2, 2, 2, (x, y, z) => ((x + y + z) % 2 === 0 ? SOLID : EMPTY));
    expect(countSolidVoxels(chunk)).toBe(4);
  });
});

describe('isHeightfieldShape', () => {
  test('detects flat ground as heightfield', () => {
    const chunk = makeChunk(4, 4, 4, (_x, y, _z) => (y === 0 ? SOLID : EMPTY));
    expect(isHeightfieldShape(chunk)).toBe(true);
  });

  test('detects stepped terrain as heightfield', () => {
    const chunk = makeChunk(4, 4, 4, (x, y, _z) => (y < (x % 3) + 1 ? SOLID : EMPTY));
    expect(isHeightfieldShape(chunk)).toBe(true);
  });

  test('rejects floating blocks', () => {
    const chunk = makeChunk(2, 4, 2, (_x, y, _z) => (y === 2 ? SOLID : EMPTY));
    expect(isHeightfieldShape(chunk)).toBe(false);
  });
});

describe('buildHeightFieldShape', () => {
  test('emits one sample per (x,z) column', () => {
    const chunk = makeChunk(3, 4, 3, (_x, y, _z) => (y === 0 ? SOLID : EMPTY));
    const shape = buildHeightFieldShape(chunk, 1);
    expect(shape.kind).toBe('heightField');
    if (shape.kind !== 'heightField') throw new Error();
    expect(shape.columns).toBe(3);
    expect(shape.rows).toBe(3);
    expect(shape.samples.length).toBe(9);
    for (const s of shape.samples) expect(s).toBeCloseTo(1, 5);
  });
});

describe('buildCompoundBoxShape', () => {
  test('one box child per solid voxel', () => {
    const chunk = makeChunk(2, 2, 2, (x, y, z) => (x === 0 && y === 0 && z === 0 ? SOLID : EMPTY));
    const shape = buildCompoundBoxShape(chunk, 1);
    expect(shape.kind).toBe('compound');
    if (shape.kind !== 'compound') throw new Error();
    expect(shape.children.length).toBe(1);
    expect(shape.children[0]!.transform.position).toEqual({ x: 0.5, y: 0.5, z: 0.5 });
  });
});

describe('buildSurfaceMeshShape', () => {
  test('emits surface faces only', () => {
    // 2x2x2 fully solid cube: only 6 outer faces (not the inner 0).
    // Each face is two tris = 6 indices = 12 verts (no shared verts in our impl).
    const chunk = makeChunk(2, 2, 2, () => SOLID);
    const shape = buildSurfaceMeshShape(chunk, 1);
    if (shape.kind !== 'mesh') throw new Error();
    // 2x2 outer faces × 6 sides = 24 quads -> 48 tris -> 144 indices
    // (each cube emits 3 faces toward the chunk-edge that always emit, and
    // 3 faces toward in-chunk neighbors that get culled).
    // For a 2³ chunk: 8 voxels, 3 chunk-edge faces each = 24 quads.
    expect(shape.indices.length / 6).toBe(24);
  });

  test('emits all outer faces for a single solid voxel', () => {
    const chunk = makeChunk(1, 1, 1, () => SOLID);
    const shape = buildSurfaceMeshShape(chunk, 1);
    if (shape.kind !== 'mesh') throw new Error();
    // 6 faces × 2 tris × 3 indices = 36 indices.
    expect(shape.indices.length).toBe(36);
  });
});

describe('ChunkColliderBuilder.build', () => {
  test('returns null for empty chunk', () => {
    const chunk = makeChunk(2, 2, 2, () => EMPTY);
    const result = new ChunkColliderBuilder({ voxelSize: 1 }).build(chunk);
    expect(result).toBeNull();
  });

  test('chooses heightField for terrain', () => {
    const chunk = makeChunk(4, 4, 4, (_x, y, _z) => (y === 0 ? SOLID : EMPTY));
    const result = new ChunkColliderBuilder({ voxelSize: 1 }).build(chunk);
    expect(result?.chosenKind).toBe('heightField');
  });

  test('chooses mesh for dense chunks', () => {
    const chunk = makeChunk(4, 4, 4, () => SOLID);
    const result = new ChunkColliderBuilder({ voxelSize: 1 }).build(chunk);
    expect(result?.chosenKind).toBe('mesh');
  });

  test('chooses compound for sparse chunks under cap', () => {
    const chunk = makeChunk(8, 8, 8, (x, y, z) => (x === 0 && y === 4 && z === 0 ? SOLID : EMPTY));
    const result = new ChunkColliderBuilder({ voxelSize: 1, denseRatio: 0.99 }).build(chunk);
    expect(result?.chosenKind).toBe('compound');
  });

  test('falls back to mesh above box cap', () => {
    // Floating sparse blocks above cap → mesh.
    const chunk = makeChunk(8, 8, 8, (_x, y, _z) => (y === 4 ? SOLID : EMPTY)); // 64 floating voxels.
    const result = new ChunkColliderBuilder({ voxelSize: 1, denseRatio: 0.99, boxCap: 32 }).build(chunk);
    expect(result?.chosenKind).toBe('mesh');
  });

  test('worldOrigin uses chunk origin × chunkSize × voxelSize', () => {
    const sx = 4, sy = 4, sz = 4;
    const voxels = new Uint8Array(sx * sy * sz);
    for (let i = 0; i < voxels.length; i++) voxels[i] = SOLID;
    const chunk: Chunk = {
      id: 'c1',
      chunkOrigin: { cx: 1, cy: 0, cz: -1 },
      size: { sx, sy, sz },
      voxels,
    };
    const result = new ChunkColliderBuilder({ voxelSize: 2 }).build(chunk);
    expect(result?.worldOrigin).toEqual({ x: 8, y: 0, z: -8 });
  });
});
