import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { Surreal } from 'surrealdb';
import { MapCatalogService } from './MapCatalogService.js';
import type { IBuiltInWorldRepository } from './ports.js';
import type {
  MapDefinition,
  MapMetadata,
  TileKind,
  WorldDefinition,
} from '../../shared/platformer/index.js';
import { createDbConnection } from '../../infrastructure/database/client.js';
import { SurrealDbAdapter } from '../../infrastructure/database/SurrealDbAdapter.js';
import { SurrealUserMapRepository } from '../../infrastructure/database/platformer/SurrealUserMapRepository.js';
import { SurrealPlayerProgressRepository } from '../../infrastructure/database/platformer/SurrealPlayerProgressRepository.js';

function emptyTiles(cols: number, rows: number): TileKind[][] {
  const tiles: TileKind[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => 'empty' as TileKind),
  );
  for (let c = 0; c < cols; c++) tiles[rows - 1]![c] = 'ground';
  return tiles;
}

function makeMap(id = 'm'): MapDefinition {
  return {
    id, version: 1,
    size: { cols: 10, rows: 6 }, tileSize: 16, scrollMode: 'horizontal',
    spawn: { col: 1, row: 4 },
    goal: { col: 8, row: 4, kind: 'flag' },
    tiles: emptyTiles(10, 6),
    entities: [],
    background: 'sky', music: 'overworld',
  };
}

class FakeBuiltIns implements IBuiltInWorldRepository {
  constructor(private readonly worlds: WorldDefinition[]) {}
  async listWorlds(): Promise<WorldDefinition[]> { return this.worlds; }
  async getWorld(id: string) { return this.worlds.find((w) => w.id === id) ?? null; }
}

const meta: MapMetadata = {
  title: 'My Level', author: 'me',
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  source: 'user',
};

describe('MapCatalogService', () => {
  let db: Surreal;
  let userRepo: SurrealUserMapRepository;
  let progressRepo: SurrealPlayerProgressRepository;

  beforeEach(async () => {
    db = await createDbConnection({
      host: 'mem://',
      namespace: `test_ns_${crypto.randomUUID()}`,
      database: `test_db_${crypto.randomUUID()}`,
    });
    const adapter = new SurrealDbAdapter(db);
    userRepo = new SurrealUserMapRepository(adapter);
    progressRepo = new SurrealPlayerProgressRepository(adapter);
  });

  afterEach(async () => { await db.close(); });

  test('listBuiltInWorlds returns the built-in repository list', async () => {
    const world: WorldDefinition = {
      id: 'world-1',
      label: 'Demo',
      levels: [{ id: 'l1', label: '1-1', map: makeMap('world-1/l1') }],
    };
    const svc = new MapCatalogService(new FakeBuiltIns([world]), userRepo, progressRepo);
    expect(await svc.listBuiltInWorlds()).toEqual([world]);
  });

  test('listMaps returns built-in levels and user maps in a single resolved view', async () => {
    const world: WorldDefinition = {
      id: 'world-1', label: 'Demo', levels: [{ id: 'l1', label: '1-1', map: makeMap('world-1/l1') }],
    };
    await userRepo.save({ id: 'mine-1', metadata: meta, definition: makeMap('mine-1') });
    const svc = new MapCatalogService(new FakeBuiltIns([world]), userRepo, progressRepo);
    const list = await svc.listMaps();
    const sources = list.map((e) => e.source).sort();
    expect(sources).toEqual(['builtin', 'user']);
    expect(list.find((e) => e.source === 'builtin')!.isEditable).toBe(false);
    expect(list.find((e) => e.source === 'user')!.isEditable).toBe(true);
  });

  test('saveUserMap rejects invalid maps with descriptive errors', async () => {
    const svc = new MapCatalogService(new FakeBuiltIns([]), userRepo, progressRepo);
    const broken = makeMap('broken');
    broken.spawn = { col: -1, row: 0 };
    await expect(svc.saveUserMap({ metadata: meta, definition: broken })).rejects.toThrow(/Invalid map/);
  });

  test('duplicateBuiltIn writes a user-owned copy that inherits from the source', async () => {
    const world: WorldDefinition = {
      id: 'world-1', label: 'Demo', levels: [{ id: 'l1', label: '1-1', map: makeMap('world-1/l1') }],
    };
    const svc = new MapCatalogService(new FakeBuiltIns([world]), userRepo, progressRepo);
    const dup = await svc.duplicateBuiltIn('world-1/l1', { author: 'me' });
    expect(dup.source).toBe('user');
    expect(dup.inheritsFromBuiltInId).toBe('world-1/l1');
    expect(await userRepo.list()).toHaveLength(1);
  });

  test('recordRunResult appends to history and saves the latest profile', async () => {
    const svc = new MapCatalogService(new FakeBuiltIns([]), userRepo, progressRepo);
    await svc.recordRunResult({
      playerId: 'p1',
      profile: { lives: 2, score: 100, coins: 1, power: 'grow' },
      result: {
        worldId: 'world-1', levelId: 'l1', outcome: 'completed',
        score: 100, coins: 1, timeMs: 1000, completedAt: '2025-01-01T00:00:00Z',
      },
    });
    const stored = await progressRepo.load('p1');
    expect(stored?.profile.score).toBe(100);
    expect(stored?.history).toHaveLength(1);
  });
});
