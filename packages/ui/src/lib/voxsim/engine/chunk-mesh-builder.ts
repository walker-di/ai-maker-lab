import {
  BoxGeometry,
  Color,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
} from 'three';

import type { Chunk, ChunkSize, VoxelKind } from '../types.js';
import { voxelIndex, voxelKindFromOrdinal } from '../types.js';
import type { AssetBundle, VoxelMaterialConfig } from './asset-registry.js';

/**
 * Builds one `InstancedMesh` per non-empty `VoxelKind` per chunk. Empty
 * chunks (every voxel is `empty`) produce zero meshes. Frustum culling is
 * applied at the chunk level via the chunk's bounding box; per-voxel culling
 * stays out of this iteration.
 *
 * Greedy meshing is reserved for a future iteration; see Risks in plan 01.
 */

export interface ChunkMeshes {
  chunkId: string;
  /** One entry per `VoxelKind` that appears at least once in the chunk. */
  meshes: ChunkMeshEntry[];
}

export interface ChunkMeshEntry {
  kind: VoxelKind;
  mesh: InstancedMesh;
  /** Number of populated instances. Always equals `mesh.count`. */
  instanceCount: number;
}

export interface ChunkMeshBuilderOptions {
  bundle: AssetBundle;
  voxelSize: number;
}

const _scratch = new Object3D();

export class ChunkMeshBuilder {
  private readonly geometry = new BoxGeometry(1, 1, 1);
  private readonly materialCache = new Map<VoxelKind, MeshStandardMaterial>();
  private readonly bundle: AssetBundle;
  private readonly voxelSize: number;

  constructor(options: ChunkMeshBuilderOptions) {
    this.bundle = options.bundle;
    this.voxelSize = options.voxelSize;
  }

  /**
   * Build the instanced meshes for a single chunk. Returns an empty `meshes`
   * array if every voxel is `empty`.
   */
  build(chunk: Chunk): ChunkMeshes {
    const counts = countVoxelsByKind(chunk);
    const entries: ChunkMeshEntry[] = [];

    for (const [kind, count] of counts) {
      if (count === 0) continue;
      const config = this.bundle.voxelMaterials[kind];
      if (!shouldRenderVoxelKind(kind, config)) continue;

      const material = this.materialFor(kind, config);
      const mesh = new InstancedMesh(this.geometry, material, count);
      mesh.name = `voxsim:chunk:${chunk.id}:${kind}`;
      mesh.frustumCulled = true;
      this.populateInstances(mesh, chunk, kind);
      mesh.instanceMatrix.needsUpdate = true;
      entries.push({ kind, mesh, instanceCount: count });
    }

    return { chunkId: chunk.id, meshes: entries };
  }

  /**
   * Dispose all GPU resources owned by this builder. Geometries are shared
   * across chunks so this is called once on engine teardown.
   */
  dispose(): void {
    this.geometry.dispose();
    for (const material of this.materialCache.values()) material.dispose();
    this.materialCache.clear();
  }

  private materialFor(kind: VoxelKind, config: VoxelMaterialConfig): MeshStandardMaterial {
    let material = this.materialCache.get(kind);
    if (material) return material;
    material = new MeshStandardMaterial({
      color: new Color(config.color),
      roughness: config.roughness,
      metalness: config.metalness,
    });
    this.materialCache.set(kind, material);
    return material;
  }

  private populateInstances(mesh: InstancedMesh, chunk: Chunk, kind: VoxelKind): void {
    const { sx, sy, sz } = chunk.size;
    const span = this.voxelSize;
    const half = span * 0.5;
    const originX = chunk.chunkOrigin.cx * sx * span;
    const originY = chunk.chunkOrigin.cy * sy * span;
    const originZ = chunk.chunkOrigin.cz * sz * span;
    let instance = 0;
    for (let z = 0; z < sz; z++) {
      for (let y = 0; y < sy; y++) {
        for (let x = 0; x < sx; x++) {
          const ord = chunk.voxels[voxelIndex(chunk.size, x, y, z)]!;
          const k = voxelKindFromOrdinal(ord);
          if (k !== kind) continue;
          _scratch.position.set(
            originX + x * span + half,
            originY + y * span + half,
            originZ + z * span + half,
          );
          _scratch.scale.set(span, span, span);
          _scratch.rotation.set(0, 0, 0);
          _scratch.updateMatrix();
          mesh.setMatrixAt(instance++, _scratch.matrix);
        }
      }
    }
    mesh.count = instance;
  }
}

function shouldRenderVoxelKind(kind: VoxelKind, config: VoxelMaterialConfig | undefined): boolean {
  if (!config) return false;
  if (kind === 'empty') return false;
  return true;
}

/** Count voxels per kind in a chunk. Exported for tests. */
export function countVoxelsByKind(chunk: Chunk): Map<VoxelKind, number> {
  const counts = new Map<VoxelKind, number>();
  const total = chunk.voxels.length;
  for (let i = 0; i < total; i++) {
    const ord = chunk.voxels[i]!;
    const kind = voxelKindFromOrdinal(ord);
    if (kind === undefined) continue;
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  return counts;
}

/** Total voxel count for a chunk, derived from its size. Exported for tests. */
export function chunkTotalVoxels(size: ChunkSize): number {
  return size.sx * size.sy * size.sz;
}
