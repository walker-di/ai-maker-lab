import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { Surreal } from 'surrealdb';
import { createDbConnection } from '../client.js';
import { SurrealDbAdapter } from '../SurrealDbAdapter.js';
import { SurrealUserMapRepository } from './SurrealUserMapRepository.js';
import type { MapDefinition, MapMetadata, TileKind } from '../../../shared/platformer/index.js';

function emptyTiles(cols: number, rows: number): TileKind[][] {
  const tiles: TileKind[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => 'empty' as TileKind),
  );
  for (let c = 0; c < cols; c++) tiles[rows - 1]![c] = 'ground';
  return tiles;
}

function makeMap(id: string): MapDefinition {
  return {
    id, version: 1,
    size: { cols: 8, rows: 5 }, tileSize: 16, scrollMode: 'horizontal',
    spawn: { col: 1, row: 3 }, goal: { col: 6, row: 3, kind: 'flag' },
    tiles: emptyTiles(8, 5), entities: [],
    background: 'sky', music: 'overworld',
  };
}

const baseMeta: MapMetadata = {
  title: 'Test', author: 'me',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  source: 'user',
};

describe('SurrealUserMapRepository', () => {
  let db: Surreal;
  let repo: SurrealUserMapRepository;

  beforeEach(async () => {
    db = await createDbConnection({
      host: 'mem://',
      namespace: `test_ns_${crypto.randomUUID()}`,
      database: `test_db_${crypto.randomUUID()}`,
    });
    repo = new SurrealUserMapRepository(new SurrealDbAdapter(db));
  });

  afterEach(async () => { await db.close(); });

  test('save/list/get round-trips a user map', async () => {
    const saved = await repo.save({ id: 'm1', metadata: baseMeta, definition: makeMap('m1') });
    expect(saved.id).toBe('m1');
    expect((await repo.list()).map((m) => m.id)).toEqual(['m1']);
    expect(await repo.get('m1')).toMatchObject({ id: 'm1', metadata: baseMeta });
  });

  test('remove deletes the map and removes it from list/get', async () => {
    await repo.save({ id: 'm1', metadata: baseMeta, definition: makeMap('m1') });
    await repo.remove('m1');
    expect(await repo.get('m1')).toBeNull();
    expect(await repo.list()).toEqual([]);
  });

  test('save updates an existing record in place', async () => {
    await repo.save({ id: 'm1', metadata: baseMeta, definition: makeMap('m1') });
    await repo.save({
      id: 'm1',
      metadata: { ...baseMeta, title: 'Renamed' },
      definition: makeMap('m1'),
    });
    expect((await repo.get('m1'))?.metadata.title).toBe('Renamed');
  });
});
