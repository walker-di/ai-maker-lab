import { describe, expect, test } from 'bun:test';
import type { MapDefinition } from './map-types.js';
import type { TileKind } from './tile-types.js';
import { validateMapDefinition } from './validation.js';

function emptyTiles(cols: number, rows: number, fill: TileKind = 'empty'): TileKind[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => fill),
  );
}

function makeMap(overrides: Partial<MapDefinition> = {}): MapDefinition {
  const cols = overrides.size?.cols ?? 6;
  const rows = overrides.size?.rows ?? 4;
  return {
    id: 'test-map',
    version: 1,
    size: { cols, rows },
    tileSize: 16,
    scrollMode: 'horizontal',
    spawn: { col: 1, row: 1 },
    goal: { col: cols - 1, row: 1, kind: 'flag' },
    tiles: emptyTiles(cols, rows),
    entities: [],
    background: 'sky',
    music: 'overworld',
    ...overrides,
  } as MapDefinition;
}

describe('validateMapDefinition', () => {
  test('accepts a well-formed map', () => {
    const result = validateMapDefinition(makeMap());
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('flags row/column count mismatches', () => {
    const map = makeMap({ size: { cols: 4, rows: 4 } });
    map.tiles = [['empty', 'empty', 'empty']]; // wrong rows + wrong cols
    const result = validateMapDefinition(map);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'tiles.row-count-mismatch')).toBe(true);
    expect(result.errors.some((e) => e.code === 'tiles.col-count-mismatch')).toBe(true);
  });

  test('rejects out-of-bounds spawn', () => {
    const result = validateMapDefinition(makeMap({ spawn: { col: 99, row: 99 } }));
    expect(result.errors.some((e) => e.code === 'spawn.out-of-bounds')).toBe(true);
  });

  test('rejects spawn placed on a solid tile', () => {
    const map = makeMap();
    map.tiles[1]![1] = 'ground';
    const result = validateMapDefinition(map);
    expect(result.errors.some((e) => e.code === 'spawn.solid-tile')).toBe(true);
  });

  test('rejects out-of-bounds goal', () => {
    const result = validateMapDefinition(
      makeMap({ goal: { col: -1, row: 0, kind: 'flag' } }),
    );
    expect(result.errors.some((e) => e.code === 'goal.out-of-bounds')).toBe(true);
  });

  test('rejects entities placed outside bounds', () => {
    const result = validateMapDefinition(
      makeMap({
        entities: [{ kind: 'coin', tile: { col: 100, row: 0 } }],
      }),
    );
    expect(result.errors.some((e) => e.code === 'entity.out-of-bounds')).toBe(true);
  });

  test('rejects duplicate player entity', () => {
    const result = validateMapDefinition(
      makeMap({
        entities: [{ kind: 'player', tile: { col: 0, row: 0 } }],
      }),
    );
    expect(result.errors.some((e) => e.code === 'entity.player-not-allowed')).toBe(true);
  });
});
