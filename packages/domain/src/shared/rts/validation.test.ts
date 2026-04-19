import { describe, expect, test } from 'bun:test';
import type { MapDefinition } from './map-types.js';
import { validateMapDefinition } from './validation.js';

function flat(cols: number, rows: number, terrain: 'grass' | 'water' = 'grass'): MapDefinition {
  return {
    id: 'm',
    version: 1,
    size: { cols, rows },
    tileSize: { width: 64, height: 32 },
    maxAltitude: 2,
    terrain: Array.from({ length: rows }, () => Array.from({ length: cols }, () => terrain)),
    altitude: { levels: Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0)) },
    resources: [],
    spawns: [{ factionId: 'p1', tile: { col: 1, row: 1 } }],
    metadata: {
      title: 't',
      author: 'a',
      createdAt: '1970-01-01T00:00:00Z',
      updatedAt: '1970-01-01T00:00:00Z',
      source: 'builtin',
    },
  };
}

describe('validateMapDefinition', () => {
  test('accepts a basic flat map', () => {
    const result = validateMapDefinition(flat(8, 8));
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('rejects terrain row count mismatch', () => {
    const map = flat(4, 4);
    map.terrain.pop();
    const result = validateMapDefinition(map);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'terrain.row-count-mismatch')).toBe(true);
  });

  test('rejects altitude out of range', () => {
    const map = flat(4, 4);
    map.altitude.levels[0]![0] = 99;
    const result = validateMapDefinition(map);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'altitude.out-of-range')).toBe(true);
  });

  test('warns when cliff has no altitude delta', () => {
    const map = flat(4, 4);
    map.terrain[1]![1] = 'cliff';
    const result = validateMapDefinition(map);
    expect(result.warnings.some((w) => w.code === 'cliff.no-delta')).toBe(true);
  });

  test('rejects spawn on water', () => {
    const map = flat(4, 4);
    map.terrain[1]![1] = 'water';
    const result = validateMapDefinition(map);
    expect(result.errors.some((e) => e.code === 'spawn.not-walkable')).toBe(true);
  });

  test('rejects duplicate spawn faction', () => {
    const map = flat(4, 4);
    map.spawns.push({ factionId: 'p1', tile: { col: 2, row: 2 } });
    const result = validateMapDefinition(map);
    expect(result.errors.some((e) => e.code === 'spawn.duplicate')).toBe(true);
  });

  test('rejects resource on water', () => {
    const map = flat(4, 4);
    map.terrain[2]![2] = 'water';
    map.resources.push({ id: 'r', kind: 'mineral', tile: { col: 2, row: 2 }, amount: 100 });
    const result = validateMapDefinition(map);
    expect(result.errors.some((e) => e.code === 'resource.on-water')).toBe(true);
  });
});
