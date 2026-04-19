import { describe, expect, test } from 'bun:test';

import {
  ChunkMeshBuilder,
  countVoxelsByKind,
} from './chunk-mesh-builder.js';
import { DEFAULT_BUNDLE } from './asset-registry.js';
import {
  ordinalForVoxelKind,
  voxelIndex,
  type Chunk,
  type VoxelKind,
} from '../types.js';

function makeChunk(fill: VoxelKind, size = { sx: 4, sy: 4, sz: 4 }): Chunk {
  const voxels = new Uint8Array(size.sx * size.sy * size.sz);
  voxels.fill(ordinalForVoxelKind(fill));
  return {
    id: `chunk:0_0_0:${fill}`,
    chunkOrigin: { cx: 0, cy: 0, cz: 0 },
    size,
    voxels,
  };
}

describe('countVoxelsByKind', () => {
  test('returns the correct count per voxel kind', () => {
    const chunk = makeChunk('empty', { sx: 2, sy: 2, sz: 2 });
    chunk.voxels[0] = ordinalForVoxelKind('solid');
    chunk.voxels[1] = ordinalForVoxelKind('hazard');
    const counts = countVoxelsByKind(chunk);
    expect(counts.get('solid')).toBe(1);
    expect(counts.get('hazard')).toBe(1);
    expect(counts.get('empty')).toBe(6);
  });
});

describe('ChunkMeshBuilder', () => {
  test('produces no meshes for a fully empty chunk', () => {
    const builder = new ChunkMeshBuilder({ bundle: DEFAULT_BUNDLE, voxelSize: 1 });
    const result = builder.build(makeChunk('empty'));
    expect(result.meshes.length).toBe(0);
    builder.dispose();
  });

  test('produces one InstancedMesh per non-empty kind in the chunk', () => {
    const chunk = makeChunk('empty');
    chunk.voxels[voxelIndex(chunk.size, 0, 0, 0)] = ordinalForVoxelKind('solid');
    chunk.voxels[voxelIndex(chunk.size, 1, 0, 0)] = ordinalForVoxelKind('solid');
    chunk.voxels[voxelIndex(chunk.size, 2, 0, 0)] = ordinalForVoxelKind('hazard');
    const builder = new ChunkMeshBuilder({ bundle: DEFAULT_BUNDLE, voxelSize: 1 });
    const result = builder.build(chunk);
    expect(result.meshes.length).toBe(2);
    const kinds = result.meshes.map((m) => m.kind).sort();
    expect(kinds).toEqual(['hazard', 'solid']);
    const solid = result.meshes.find((m) => m.kind === 'solid')!;
    expect(solid.instanceCount).toBe(2);
    expect(solid.mesh.count).toBe(2);
    builder.dispose();
  });

  test('rebuilds after the source voxels change', () => {
    const chunk = makeChunk('empty');
    chunk.voxels[0] = ordinalForVoxelKind('solid');
    const builder = new ChunkMeshBuilder({ bundle: DEFAULT_BUNDLE, voxelSize: 1 });
    const first = builder.build(chunk);
    expect(first.meshes.find((m) => m.kind === 'solid')!.instanceCount).toBe(1);

    chunk.voxels[1] = ordinalForVoxelKind('solid');
    chunk.voxels[2] = ordinalForVoxelKind('solid');
    const second = builder.build(chunk);
    expect(second.meshes.find((m) => m.kind === 'solid')!.instanceCount).toBe(3);
    builder.dispose();
  });

  test('positions instances at voxelOrigin + voxelIndex * voxelSize', () => {
    const chunk = makeChunk('empty', { sx: 2, sy: 1, sz: 1 });
    chunk.voxels[voxelIndex(chunk.size, 1, 0, 0)] = ordinalForVoxelKind('solid');
    const builder = new ChunkMeshBuilder({ bundle: DEFAULT_BUNDLE, voxelSize: 2 });
    const result = builder.build(chunk);
    const solid = result.meshes.find((m) => m.kind === 'solid')!;
    const matrixElements = Array.from(solid.mesh.instanceMatrix.array.slice(0, 16));
    const tx = matrixElements[12];
    expect(tx).toBeCloseTo(2 * 1 + 1, 5); // x=1 voxel, voxelSize=2, half=1
    builder.dispose();
  });
});
