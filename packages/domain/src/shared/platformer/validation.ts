import type { MapDefinition } from './map-types.js';
import { isSolidTile, type TileKind } from './tile-types.js';

export interface MapValidationIssue {
  code: string;
  message: string;
  cell?: { col: number; row: number };
}

export interface MapValidationResult {
  ok: boolean;
  errors: MapValidationIssue[];
  warnings: MapValidationIssue[];
}

function inBounds(map: MapDefinition, col: number, row: number): boolean {
  return col >= 0 && row >= 0 && col < map.size.cols && row < map.size.rows;
}

export function validateMapDefinition(map: MapDefinition): MapValidationResult {
  const errors: MapValidationIssue[] = [];
  const warnings: MapValidationIssue[] = [];

  if (map.tiles.length !== map.size.rows) {
    errors.push({
      code: 'tiles.row-count-mismatch',
      message: `Expected ${map.size.rows} rows of tiles, found ${map.tiles.length}.`,
    });
  }

  for (let row = 0; row < map.tiles.length; row++) {
    const r = map.tiles[row];
    if (!r || r.length !== map.size.cols) {
      errors.push({
        code: 'tiles.col-count-mismatch',
        message: `Row ${row} expected ${map.size.cols} columns, found ${r?.length ?? 0}.`,
      });
    }
  }

  if (!inBounds(map, map.spawn.col, map.spawn.row)) {
    errors.push({
      code: 'spawn.out-of-bounds',
      message: `Spawn (${map.spawn.col}, ${map.spawn.row}) is outside the map bounds.`,
      cell: map.spawn,
    });
  } else {
    const spawnTile = map.tiles[map.spawn.row]?.[map.spawn.col] as TileKind | undefined;
    if (spawnTile && isSolidTile(spawnTile)) {
      errors.push({
        code: 'spawn.solid-tile',
        message: `Spawn cell sits on a solid tile (${spawnTile}).`,
        cell: map.spawn,
      });
    }
  }

  if (!inBounds(map, map.goal.col, map.goal.row)) {
    errors.push({
      code: 'goal.out-of-bounds',
      message: `Goal (${map.goal.col}, ${map.goal.row}) is outside the map bounds.`,
      cell: { col: map.goal.col, row: map.goal.row },
    });
  }

  let playerSpawnCount = 0;
  for (const entity of map.entities) {
    if (!inBounds(map, entity.tile.col, entity.tile.row)) {
      errors.push({
        code: 'entity.out-of-bounds',
        message: `Entity ${entity.kind} at (${entity.tile.col}, ${entity.tile.row}) is outside the map bounds.`,
        cell: entity.tile,
      });
    }
    if (entity.kind === 'player') {
      playerSpawnCount++;
    }
  }

  if (playerSpawnCount > 0) {
    errors.push({
      code: 'entity.player-not-allowed',
      message: 'Player spawn must be expressed via map.spawn, not as an entity.',
    });
  }

  return { ok: errors.length === 0, errors, warnings };
}
