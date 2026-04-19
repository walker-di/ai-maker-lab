/**
 * Built-in arena loader. Reads compact JSON arena recipes from disk and
 * inflates them into full `ArenaDefinition` instances with `Uint8Array`-backed
 * chunks. The compact format is JSON-friendly (no binary blobs in source) and
 * uses a tiny fill-rule vocabulary so each bundled arena fits in a few dozen
 * lines instead of base64 voxel dumps.
 *
 * Fill-rule grammar (applied in order):
 *   { type: 'yPlane', y: number, kind: VoxelKind }
 *   { type: 'box', min: Vec3i, max: Vec3i, kind: VoxelKind } // world voxel coords, inclusive
 *   { type: 'voxel', x: number, y: number, z: number, kind: VoxelKind }
 *   { type: 'ramp', axis: 'x' | 'z', from: Vec3i, length: number, height: number, kind: VoxelKind }
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import type {
  ArenaDefinition,
  ArenaMetadata,
  AgentSpawn,
  EntitySpawn,
  Vec3,
  VoxelKind,
} from '../../../shared/voxsim/index.js';
import {
  chunkIdFor,
  chunkVoxelCount,
  ordinalForVoxelKind,
  validateArenaDefinition,
  voxelIndex,
} from '../../../shared/voxsim/index.js';
import type {
  BuiltInArenaEntry,
  IBuiltInArenaSource,
} from '../../../application/voxsim/index.js';

interface Vec3Int {
  x: number;
  y: number;
  z: number;
}

type FillRule =
  | { type: 'yPlane'; y: number; kind: VoxelKind }
  | { type: 'box'; min: Vec3Int; max: Vec3Int; kind: VoxelKind }
  | { type: 'voxel'; x: number; y: number; z: number; kind: VoxelKind }
  | {
      type: 'ramp';
      axis: 'x' | 'z';
      from: Vec3Int;
      length: number;
      height: number;
      kind: VoxelKind;
    };

interface BuiltInArenaRecipe {
  id: string;
  metadata: ArenaMetadata;
  chunkSize: { sx: number; sy: number; sz: number };
  voxelSize: number;
  bounds: {
    min: { cx: number; cy: number; cz: number };
    max: { cx: number; cy: number; cz: number };
  };
  fills: FillRule[];
  spawns: AgentSpawn[];
  entities?: EntitySpawn[];
  gravity?: Vec3;
  skybox?: string;
  version?: number;
}

const DEFAULT_BUILTINS_DIR = fileURLToPath(new URL('./', import.meta.url));
const RECIPE_FILES = ['flat-arena.json', 'slope-arena.json', 'obstacle-course.json'] as const;

/**
 * Read built-in arena JSON recipes from disk and inflate them into
 * `ArenaDefinition` instances. Cached after first load.
 */
export class JsonBuiltInArenaSource implements IBuiltInArenaSource {
  private cache: BuiltInArenaEntry[] | null = null;

  constructor(private readonly directory: string = DEFAULT_BUILTINS_DIR) {}

  async listArenas(): Promise<BuiltInArenaEntry[]> {
    if (!this.cache) {
      const entries: BuiltInArenaEntry[] = [];
      for (const file of RECIPE_FILES) {
        const full = path.join(this.directory, file);
        const raw = await readFile(full, 'utf8');
        const recipe = JSON.parse(raw) as BuiltInArenaRecipe;
        entries.push(inflateRecipe(recipe));
      }
      this.cache = entries;
    }
    return this.cache.map(cloneEntry);
  }

  async findArena(id: string): Promise<BuiltInArenaEntry | undefined> {
    const all = await this.listArenas();
    return all.find((entry) => entry.id === id);
  }
}

/**
 * In-memory variant for tests. Accepts already-inflated entries so tests don't
 * have to round-trip through disk.
 */
export class InMemoryBuiltInArenaSource implements IBuiltInArenaSource {
  constructor(private readonly entries: BuiltInArenaEntry[]) {}

  async listArenas(): Promise<BuiltInArenaEntry[]> {
    return this.entries.map(cloneEntry);
  }

  async findArena(id: string): Promise<BuiltInArenaEntry | undefined> {
    const hit = this.entries.find((entry) => entry.id === id);
    return hit ? cloneEntry(hit) : undefined;
  }
}

/**
 * Inflate a recipe into a full `ArenaDefinition`. Validates the result and
 * throws on invalid bundled data so authoring mistakes fail loudly at server
 * boot rather than at runtime.
 */
export function inflateRecipe(recipe: BuiltInArenaRecipe): BuiltInArenaEntry {
  const definition = recipeToArenaDefinition(recipe);
  const validation = validateArenaDefinition(definition);
  if (!validation.ok) {
    const messages = validation.errors.map((e) => `${e.code}: ${e.message}`).join('; ');
    throw new Error(`Invalid built-in arena ${recipe.id}: ${messages}`);
  }
  return {
    id: recipe.id,
    metadata: { ...recipe.metadata, source: 'builtin' },
    definition,
  };
}

function recipeToArenaDefinition(recipe: BuiltInArenaRecipe): ArenaDefinition {
  const { chunkSize, bounds } = recipe;
  const voxelCount = chunkVoxelCount(chunkSize);
  const chunkMap = new Map<string, Uint8Array>();

  const ensureChunk = (cx: number, cy: number, cz: number): Uint8Array => {
    const id = chunkIdFor({ cx, cy, cz });
    let buf = chunkMap.get(id);
    if (!buf) {
      buf = new Uint8Array(voxelCount);
      chunkMap.set(id, buf);
    }
    return buf;
  };

  const setVoxel = (worldX: number, worldY: number, worldZ: number, kind: VoxelKind): void => {
    const cx = Math.floor(worldX / chunkSize.sx);
    const cy = Math.floor(worldY / chunkSize.sy);
    const cz = Math.floor(worldZ / chunkSize.sz);
    if (
      cx < bounds.min.cx || cx > bounds.max.cx ||
      cy < bounds.min.cy || cy > bounds.max.cy ||
      cz < bounds.min.cz || cz > bounds.max.cz
    ) {
      return;
    }
    const localX = ((worldX % chunkSize.sx) + chunkSize.sx) % chunkSize.sx;
    const localY = ((worldY % chunkSize.sy) + chunkSize.sy) % chunkSize.sy;
    const localZ = ((worldZ % chunkSize.sz) + chunkSize.sz) % chunkSize.sz;
    const buf = ensureChunk(cx, cy, cz);
    buf[voxelIndex(chunkSize, localX, localY, localZ)] = ordinalForVoxelKind(kind);
  };

  const worldVoxelMin = {
    x: bounds.min.cx * chunkSize.sx,
    y: bounds.min.cy * chunkSize.sy,
    z: bounds.min.cz * chunkSize.sz,
  };
  const worldVoxelMax = {
    x: (bounds.max.cx + 1) * chunkSize.sx - 1,
    y: (bounds.max.cy + 1) * chunkSize.sy - 1,
    z: (bounds.max.cz + 1) * chunkSize.sz - 1,
  };

  for (const fill of recipe.fills) {
    applyFill(fill, setVoxel, worldVoxelMin, worldVoxelMax);
  }

  const chunks = [];
  for (let cz = bounds.min.cz; cz <= bounds.max.cz; cz++) {
    for (let cy = bounds.min.cy; cy <= bounds.max.cy; cy++) {
      for (let cx = bounds.min.cx; cx <= bounds.max.cx; cx++) {
        const id = chunkIdFor({ cx, cy, cz });
        const voxels = chunkMap.get(id);
        if (!voxels) continue;
        let allEmpty = true;
        for (let i = 0; i < voxels.length; i++) {
          if (voxels[i] !== 0) {
            allEmpty = false;
            break;
          }
        }
        if (allEmpty) continue;
        chunks.push({
          id,
          chunkOrigin: { cx, cy, cz },
          size: { ...chunkSize },
          voxels,
        });
      }
    }
  }

  return {
    id: recipe.id,
    version: recipe.version ?? 1,
    chunkSize,
    voxelSize: recipe.voxelSize,
    bounds,
    chunks,
    spawns: recipe.spawns.map((s) => ({ ...s, pose: { position: { ...s.pose.position }, rotation: { ...s.pose.rotation } } })),
    entities: (recipe.entities ?? []).map((e) => ({
      ...e,
      pose: { position: { ...e.pose.position }, rotation: { ...e.pose.rotation } },
      params: e.params ? { ...e.params } : undefined,
    })),
    gravity: recipe.gravity ? { ...recipe.gravity } : { x: 0, y: -9.81, z: 0 },
    skybox: recipe.skybox ?? 'default',
  };
}

function applyFill(
  fill: FillRule,
  setVoxel: (x: number, y: number, z: number, kind: VoxelKind) => void,
  worldMin: Vec3Int,
  worldMax: Vec3Int,
): void {
  switch (fill.type) {
    case 'yPlane': {
      for (let z = worldMin.z; z <= worldMax.z; z++) {
        for (let x = worldMin.x; x <= worldMax.x; x++) {
          setVoxel(x, fill.y, z, fill.kind);
        }
      }
      return;
    }
    case 'box': {
      for (let z = fill.min.z; z <= fill.max.z; z++) {
        for (let y = fill.min.y; y <= fill.max.y; y++) {
          for (let x = fill.min.x; x <= fill.max.x; x++) {
            setVoxel(x, y, z, fill.kind);
          }
        }
      }
      return;
    }
    case 'voxel': {
      setVoxel(fill.x, fill.y, fill.z, fill.kind);
      return;
    }
    case 'ramp': {
      for (let i = 0; i < fill.length; i++) {
        const h = Math.min(fill.height, Math.floor((i / fill.length) * fill.height) + 1);
        for (let s = 0; s < h; s++) {
          if (fill.axis === 'x') {
            const x = fill.from.x + i;
            for (let z = fill.from.z; z < fill.from.z + 1; z++) {
              setVoxel(x, fill.from.y + s, z, fill.kind);
            }
          } else {
            const z = fill.from.z + i;
            for (let x = fill.from.x; x < fill.from.x + 1; x++) {
              setVoxel(x, fill.from.y + s, z, fill.kind);
            }
          }
        }
      }
      return;
    }
  }
}

function cloneEntry(entry: BuiltInArenaEntry): BuiltInArenaEntry {
  return {
    id: entry.id,
    metadata: { ...entry.metadata },
    definition: cloneArenaDefinition(entry.definition),
  };
}

function cloneArenaDefinition(arena: ArenaDefinition): ArenaDefinition {
  return {
    id: arena.id,
    version: arena.version,
    chunkSize: { ...arena.chunkSize },
    voxelSize: arena.voxelSize,
    bounds: { min: { ...arena.bounds.min }, max: { ...arena.bounds.max } },
    chunks: arena.chunks.map((c) => ({
      id: c.id,
      chunkOrigin: { ...c.chunkOrigin },
      size: { ...c.size },
      voxels: new Uint8Array(c.voxels),
    })),
    spawns: arena.spawns.map((s) => ({
      ...s,
      pose: {
        position: { ...s.pose.position },
        rotation: { ...s.pose.rotation },
      },
    })),
    entities: arena.entities.map((e) => ({
      ...e,
      pose: {
        position: { ...e.pose.position },
        rotation: { ...e.pose.rotation },
      },
      params: e.params ? { ...e.params } : undefined,
    })),
    gravity: { ...arena.gravity },
    skybox: arena.skybox,
  };
}
