import { describe, expect, test } from 'bun:test';
import { applyTileCellUpdates, cloneTileGrid } from './tile-layer-ops.js';

describe('tile-layer-ops', () => {
  test('clones the tile grid', () => {
    const src = [
      ['ground', 'empty'],
      ['empty', 'brick'],
    ] as const;
    const copy = cloneTileGrid(src);
    expect(copy).not.toBe(src as unknown);
    expect(copy[0]).not.toBe(src[0] as unknown);
    expect(copy).toEqual([
      ['ground', 'empty'],
      ['empty', 'brick'],
    ]);
  });

  test('applies engine tile updates in place', () => {
    const grid = cloneTileGrid([
      ['ground', 'ground'],
      ['ground', 'question'],
    ]);
    applyTileCellUpdates(grid, [
      { col: 1, row: 0, kind: 'brick' },
      { col: 0, row: 1, kind: 'empty' },
    ]);
    expect(grid[0]![1]).toBe('brick');
    expect(grid[1]![0]).toBe('empty');
    expect(grid[1]![1]).toBe('question');
  });
});
