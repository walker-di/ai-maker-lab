import { describe, expect, test } from 'bun:test';
import { TileGrid } from './tile-grid.js';
import { findPath } from './pathfinding.js';
import type { MapDefinition, TerrainKind } from '../types.js';

function makeMap(rows: TerrainKind[][], altitude?: number[][]): MapDefinition {
  const cols = rows[0]!.length;
  const rowsLen = rows.length;
  return {
    id: 'test',
    metadata: { id: 'test', title: 'Test', author: 'test', tags: [] },
    size: { cols, rows: rowsLen },
    tilePixelSize: { width: 64, height: 32 },
    altitudeStep: 16,
    terrain: rows,
    altitude: { levels: altitude ?? rows.map((r) => r.map(() => 0)) },
    spawns: [],
    resources: [],
  } as unknown as MapDefinition;
}

describe('findPath', () => {
  test('finds a straight path on flat grass', () => {
    const grid = new TileGrid(
      makeMap([
        ['grass', 'grass', 'grass', 'grass'],
        ['grass', 'grass', 'grass', 'grass'],
      ]),
    );
    const path = findPath(grid, { col: 0, row: 0 }, { col: 3, row: 1 });
    expect(path).not.toBeNull();
    expect(path![path!.length - 1]).toEqual({ col: 3, row: 1 });
  });

  test('returns null when goal is on a cliff', () => {
    const grid = new TileGrid(
      makeMap([
        ['grass', 'grass', 'cliff'],
        ['grass', 'grass', 'cliff'],
      ]),
    );
    const path = findPath(grid, { col: 0, row: 0 }, { col: 2, row: 1 });
    expect(path).toBeNull();
  });

  test('routes around water blocks', () => {
    const grid = new TileGrid(
      makeMap([
        ['grass', 'grass', 'grass'],
        ['grass', 'water', 'grass'],
        ['grass', 'grass', 'grass'],
      ]),
    );
    const path = findPath(grid, { col: 0, row: 1 }, { col: 2, row: 1 });
    expect(path).not.toBeNull();
    for (const step of path!) {
      expect(grid.getTerrain(step.col, step.row)).not.toBe('water');
    }
  });
});
