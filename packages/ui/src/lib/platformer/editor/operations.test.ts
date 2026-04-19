import { describe, expect, test } from 'bun:test';
import { applyEditorOperation } from './operations.js';
import { emptyMap } from './map-editor.svelte.ts';

describe('applyEditorOperation', () => {
  test('paintTile updates a single cell and returns a new map', () => {
    const before = emptyMap(8, 6);
    const result = applyEditorOperation(before, { type: 'paintTile', col: 2, row: 1, kind: 'brick' });
    expect(result.changed).toBe(true);
    expect(result.map.tiles[1]![2]).toBe('brick');
    expect(before.tiles[1]![2]).toBe('empty');
  });

  test('paintTile no-ops when the cell already has the kind', () => {
    const before = emptyMap();
    const r1 = applyEditorOperation(before, { type: 'paintTile', col: 0, row: 0, kind: 'empty' });
    expect(r1.changed).toBe(false);
    expect(r1.map).toBe(before);
  });

  test('paintRect paints all cells inside the rect', () => {
    const before = emptyMap(5, 5);
    const result = applyEditorOperation(before, {
      type: 'paintRect', rect: { col: 1, row: 1, cols: 2, rows: 2 }, kind: 'ground',
    });
    expect(result.changed).toBe(true);
    expect(result.map.tiles[1]!.slice(1, 3)).toEqual(['ground', 'ground']);
    expect(result.map.tiles[2]!.slice(1, 3)).toEqual(['ground', 'ground']);
  });

  test('fillTile flood-fills connected empty cells only', () => {
    const before = emptyMap(4, 4);
    before.tiles[2] = ['ground', 'ground', 'ground', 'ground'];
    const result = applyEditorOperation(before, { type: 'fillTile', col: 0, row: 0, kind: 'brick' });
    expect(result.map.tiles[0]).toEqual(['brick', 'brick', 'brick', 'brick']);
    expect(result.map.tiles[2]).toEqual(['ground', 'ground', 'ground', 'ground']);
  });

  test('placeEntity replaces any entity already at that cell', () => {
    const before = emptyMap();
    before.entities = [{ kind: 'walkerEnemy', tile: { col: 3, row: 4 } }];
    const result = applyEditorOperation(before, { type: 'placeEntity', col: 3, row: 4, kind: 'coin' });
    expect(result.map.entities).toEqual([{ kind: 'coin', tile: { col: 3, row: 4 }, params: undefined }]);
  });

  test('resizeMap preserves overlapping tiles and clips out-of-range entities', () => {
    const before = emptyMap(8, 8);
    before.tiles[3]![3] = 'brick';
    before.entities = [{ kind: 'coin', tile: { col: 7, row: 7 } }];
    const result = applyEditorOperation(before, { type: 'resizeMap', cols: 4, rows: 6 });
    expect(result.map.size).toEqual({ cols: 4, rows: 6 });
    expect(result.map.tiles[3]![3]).toBe('brick');
    expect(result.map.entities).toEqual([]);
  });
});
