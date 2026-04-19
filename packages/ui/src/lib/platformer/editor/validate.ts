import type { MapDefinition, MapValidationResult } from '../types.js';
import { isSolidTile } from '../types.js';

/**
 * UI-side mirror of `validateMapDefinition`. The editor cannot import
 * `packages/domain`, so this duplicates the rules in a structurally compatible
 * way. Keep this in sync with `packages/domain/src/shared/platformer/validation.ts`.
 */
export function validateMap(map: MapDefinition): MapValidationResult {
  const errors: MapValidationResult['errors'] = [];
  const warnings: MapValidationResult['warnings'] = [];
  const inBounds = (col: number, row: number) =>
    col >= 0 && row >= 0 && col < map.size.cols && row < map.size.rows;

  if (map.tiles.length !== map.size.rows) {
    errors.push({
      code: 'tiles.row-count-mismatch',
      message: `Expected ${map.size.rows} rows, found ${map.tiles.length}.`,
    });
  }
  for (let row = 0; row < map.tiles.length; row++) {
    if (map.tiles[row]?.length !== map.size.cols) {
      errors.push({
        code: 'tiles.col-count-mismatch',
        message: `Row ${row} expected ${map.size.cols} columns.`,
      });
    }
  }
  if (!inBounds(map.spawn.col, map.spawn.row)) {
    errors.push({
      code: 'spawn.out-of-bounds',
      message: `Spawn is outside the map bounds.`,
      cell: map.spawn,
    });
  } else if (isSolidTile(map.tiles[map.spawn.row]![map.spawn.col]!)) {
    errors.push({
      code: 'spawn.solid-tile',
      message: `Spawn cell sits on a solid tile.`,
      cell: map.spawn,
    });
  }
  if (!inBounds(map.goal.col, map.goal.row)) {
    errors.push({
      code: 'goal.out-of-bounds',
      message: `Goal is outside the map bounds.`,
      cell: map.goal,
    });
  }
  let players = 0;
  for (const entity of map.entities) {
    if (!inBounds(entity.tile.col, entity.tile.row)) {
      errors.push({
        code: 'entity.out-of-bounds',
        message: `${entity.kind} is outside the map bounds.`,
        cell: entity.tile,
      });
    }
    if (entity.kind === 'player') players++;
  }
  if (players > 0) {
    errors.push({
      code: 'entity.player-not-allowed',
      message: 'Player spawn must be expressed via map.spawn, not as an entity.',
    });
  }
  return { ok: errors.length === 0, errors, warnings };
}
