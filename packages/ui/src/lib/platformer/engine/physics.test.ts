import { describe, expect, test } from 'bun:test';
import { TileGrid } from './tile-grid.js';
import { sweepAABB } from './physics.js';
import type { MapDefinition, TileKind } from '../types.js';

function makeGrid(tiles: TileKind[][]): TileGrid {
  const map: MapDefinition = {
    id: 'm', version: 1,
    size: { cols: tiles[0]!.length, rows: tiles.length },
    tileSize: 16, scrollMode: 'horizontal',
    spawn: { col: 0, row: 0 },
    goal: { col: 0, row: 0, kind: 'flag' },
    tiles, entities: [],
    background: 'sky', music: 'overworld',
  };
  return new TileGrid(map);
}

describe('sweepAABB', () => {
  test('falling onto ground stops at tile top', () => {
    const grid = makeGrid([
      ['empty'], ['empty'], ['ground'],
    ]);
    const result = sweepAABB({ x: 0, y: 8, width: 14, height: 16 }, 0, 20, 24, grid);
    expect(result.collidedY).toBe(true);
    expect(result.newY).toBe(32 - 16);
  });

  test('jumping into a brick triggers a bump and stops upward motion', () => {
    const grid = makeGrid([
      ['brick'],
      ['empty'],
      ['ground'],
    ]);
    const result = sweepAABB({ x: 0, y: 18, width: 14, height: 14 }, 0, -10, 32, grid);
    expect(result.bumpedHead).toBe(true);
    expect(result.events.some((e) => e.type === 'tile-bumped' && e.kind === 'brick')).toBe(true);
  });

  test('walking into a wall stops X', () => {
    const grid = makeGrid([
      ['empty', 'ground'],
      ['empty', 'ground'],
    ]);
    const result = sweepAABB({ x: 0, y: 0, width: 14, height: 14 }, 30, 0, 14, grid);
    expect(result.collidedX).toBe(true);
    expect(result.newX).toBe(16 - 14);
  });

  test('hazard tile emits hazard event without blocking motion', () => {
    const grid = makeGrid([
      ['empty'],
      ['hazard'],
    ]);
    const result = sweepAABB({ x: 0, y: 4, width: 14, height: 14 }, 0, 6, 18, grid);
    expect(result.events.some((e) => e.type === 'hazard')).toBe(true);
  });
});
