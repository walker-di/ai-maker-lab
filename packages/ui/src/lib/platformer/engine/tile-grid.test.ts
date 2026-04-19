import { describe, expect, test } from 'bun:test';
import { TileGrid } from './tile-grid.js';
import type { MapDefinition, TileKind } from '../types.js';

function map(tiles: TileKind[][]): MapDefinition {
  return {
    id: 'm', version: 1,
    size: { cols: tiles[0]!.length, rows: tiles.length },
    tileSize: 16,
    scrollMode: 'horizontal',
    spawn: { col: 0, row: 0 },
    goal: { col: 0, row: 0, kind: 'flag' },
    tiles,
    entities: [],
    background: 'sky',
    music: 'overworld',
  };
}

describe('TileGrid', () => {
  test('queries solid, hazard, and bumpable cells', () => {
    const grid = new TileGrid(map([
      ['empty', 'brick', 'hazard'],
      ['ground', 'question', 'empty'],
    ]));
    expect(grid.solidAt(0, 0)).toBe(false);
    expect(grid.solidAt(1, 0)).toBe(true);
    expect(grid.bumpableAt(1, 0)).toBe(true);
    expect(grid.hazardousAt(2, 0)).toBe(true);
    expect(grid.solidAt(0, 1)).toBe(true);
    expect(grid.bumpableAt(1, 1)).toBe(true);
  });

  test('returns empty for out-of-bounds and treats as non-solid', () => {
    const grid = new TileGrid(map([['ground']]));
    expect(grid.tileAt(-1, 0)).toBe('empty');
    expect(grid.tileAt(0, -1)).toBe('empty');
    expect(grid.solidAt(99, 99)).toBe(false);
  });

  test('forEachOverlap iterates all cells the AABB touches', () => {
    const grid = new TileGrid(map([
      ['empty', 'empty', 'empty'],
      ['empty', 'empty', 'empty'],
      ['ground', 'ground', 'ground'],
    ]));
    const visited: { col: number; row: number }[] = [];
    grid.forEachOverlap({ x: 4, y: 4, width: 30, height: 30 }, (o) => visited.push({ col: o.col, row: o.row }));
    expect(visited).toEqual([
      { col: 0, row: 0 }, { col: 1, row: 0 }, { col: 2, row: 0 },
      { col: 0, row: 1 }, { col: 1, row: 1 }, { col: 2, row: 1 },
      { col: 0, row: 2 }, { col: 1, row: 2 }, { col: 2, row: 2 },
    ]);
  });

  test('does not include a tile whose top edge exactly meets the box bottom', () => {
    const grid = new TileGrid(map([
      ['empty', 'empty'],
      ['ground', 'ground'],
    ]));
    const visited: { col: number; row: number }[] = [];
    grid.forEachOverlap({ x: 0, y: 0, width: 16, height: 16 }, (o) => visited.push({ col: o.col, row: o.row }));
    expect(visited).toEqual([{ col: 0, row: 0 }]);
  });
});
