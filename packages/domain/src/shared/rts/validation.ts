import type { TilePos } from './iso.js';
import type { MapDefinition } from './map-types.js';
import { getTerrainMetadata, type TerrainKind } from './terrain.js';

export interface MapValidationIssue {
  code: string;
  message: string;
  cell?: TilePos;
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

  if (map.terrain.length !== map.size.rows) {
    errors.push({
      code: 'terrain.row-count-mismatch',
      message: `Expected ${map.size.rows} terrain rows, found ${map.terrain.length}.`,
    });
  }
  if (map.altitude.levels.length !== map.size.rows) {
    errors.push({
      code: 'altitude.row-count-mismatch',
      message: `Expected ${map.size.rows} altitude rows, found ${map.altitude.levels.length}.`,
    });
  }

  for (let row = 0; row < map.size.rows; row++) {
    const tRow = map.terrain[row];
    const aRow = map.altitude.levels[row];
    if (!tRow || tRow.length !== map.size.cols) {
      errors.push({
        code: 'terrain.col-count-mismatch',
        message: `Terrain row ${row} expected ${map.size.cols} columns, found ${tRow?.length ?? 0}.`,
      });
    }
    if (!aRow || aRow.length !== map.size.cols) {
      errors.push({
        code: 'altitude.col-count-mismatch',
        message: `Altitude row ${row} expected ${map.size.cols} columns, found ${aRow?.length ?? 0}.`,
      });
    }
    if (aRow) {
      for (let col = 0; col < aRow.length; col++) {
        const a = aRow[col]!;
        if (!Number.isInteger(a) || a < 0 || a > map.maxAltitude) {
          errors.push({
            code: 'altitude.out-of-range',
            message: `Altitude ${a} at (${col}, ${row}) is outside 0..${map.maxAltitude}.`,
            cell: { col, row },
          });
        }
      }
    }
  }

  // Cliff cells must have at least one neighbor with a different altitude.
  for (let row = 0; row < map.size.rows; row++) {
    for (let col = 0; col < map.size.cols; col++) {
      const terrain = map.terrain[row]?.[col] as TerrainKind | undefined;
      if (terrain !== 'cliff') continue;
      const a = map.altitude.levels[row]?.[col] ?? 0;
      let hasDelta = false;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nc = col + dc;
        const nr = row + dr;
        if (!inBounds(map, nc, nr)) continue;
        const na = map.altitude.levels[nr]?.[nc] ?? 0;
        if (na !== a) {
          hasDelta = true;
          break;
        }
      }
      if (!hasDelta) {
        warnings.push({
          code: 'cliff.no-delta',
          message: `Cliff at (${col}, ${row}) has no altitude delta with any neighbor.`,
          cell: { col, row },
        });
      }
    }
  }

  // Spawns: in bounds, walkable, not cliff, no duplicates per faction.
  const seenSpawn = new Set<string>();
  for (const spawn of map.spawns) {
    if (seenSpawn.has(spawn.factionId)) {
      errors.push({
        code: 'spawn.duplicate',
        message: `Duplicate spawn for faction ${spawn.factionId}.`,
      });
    }
    seenSpawn.add(spawn.factionId);
    if (!inBounds(map, spawn.tile.col, spawn.tile.row)) {
      errors.push({
        code: 'spawn.out-of-bounds',
        message: `Spawn for ${spawn.factionId} at (${spawn.tile.col}, ${spawn.tile.row}) is out of bounds.`,
        cell: spawn.tile,
      });
      continue;
    }
    const t = map.terrain[spawn.tile.row]?.[spawn.tile.col] as TerrainKind | undefined;
    if (!t) continue;
    if (t === 'cliff' || !getTerrainMetadata(t).walkable) {
      errors.push({
        code: 'spawn.not-walkable',
        message: `Spawn for ${spawn.factionId} at (${spawn.tile.col}, ${spawn.tile.row}) sits on ${t}.`,
        cell: spawn.tile,
      });
    }
  }

  // Resources: in bounds, not on water.
  for (const node of map.resources) {
    if (!inBounds(map, node.tile.col, node.tile.row)) {
      errors.push({
        code: 'resource.out-of-bounds',
        message: `Resource ${node.id} at (${node.tile.col}, ${node.tile.row}) is out of bounds.`,
        cell: node.tile,
      });
      continue;
    }
    const t = map.terrain[node.tile.row]?.[node.tile.col] as TerrainKind | undefined;
    if (t === 'water') {
      errors.push({
        code: 'resource.on-water',
        message: `Resource ${node.id} at (${node.tile.col}, ${node.tile.row}) sits on water.`,
        cell: node.tile,
      });
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
