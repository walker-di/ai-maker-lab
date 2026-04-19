import type {
  EntityKind,
  EntityParamValue,
  GoalKind,
  MapDefinition,
  MapMetadata,
  TileKind,
} from '../types.js';

export interface Rect {
  col: number;
  row: number;
  cols: number;
  rows: number;
}

export type EditorOperation =
  | { type: 'paintTile'; col: number; row: number; kind: TileKind }
  | { type: 'paintRect'; rect: Rect; kind: TileKind }
  | { type: 'fillTile'; col: number; row: number; kind: TileKind }
  | { type: 'eraseTile'; col: number; row: number }
  | { type: 'placeEntity'; col: number; row: number; kind: EntityKind; params?: Record<string, EntityParamValue> }
  | { type: 'removeEntityAt'; col: number; row: number }
  | { type: 'setSpawn'; col: number; row: number }
  | { type: 'setGoal'; col: number; row: number; kind: GoalKind }
  | { type: 'resizeMap'; cols: number; rows: number }
  | { type: 'updateMetadata'; meta: Partial<MapMetadata> };

export type EditorToolKind =
  | 'brush'
  | 'fill'
  | 'rectangle'
  | 'eraser'
  | 'pan'
  | 'entity'
  | 'spawn'
  | 'goal';

function inBounds(map: MapDefinition, col: number, row: number): boolean {
  return col >= 0 && row >= 0 && col < map.size.cols && row < map.size.rows;
}

function cloneMap(map: MapDefinition): MapDefinition {
  return {
    ...map,
    size: { ...map.size },
    spawn: { ...map.spawn },
    goal: { ...map.goal },
    tiles: map.tiles.map((row) => [...row]),
    entities: map.entities.map((e) => ({ ...e, tile: { ...e.tile }, params: e.params ? { ...e.params } : undefined })),
  };
}

export interface OperationResult {
  map: MapDefinition;
  changed: boolean;
}

/**
 * Apply a single editor operation to a map. Pure: returns a new `MapDefinition`
 * unless the operation was rejected (out-of-bounds, no-op).
 */
export function applyEditorOperation(map: MapDefinition, op: EditorOperation): OperationResult {
  switch (op.type) {
    case 'paintTile':
      if (!inBounds(map, op.col, op.row)) return { map, changed: false };
      if (map.tiles[op.row]![op.col] === op.kind) return { map, changed: false };
      {
        const next = cloneMap(map);
        next.tiles[op.row]![op.col] = op.kind;
        return { map: next, changed: true };
      }
    case 'eraseTile':
      if (!inBounds(map, op.col, op.row)) return { map, changed: false };
      if (map.tiles[op.row]![op.col] === 'empty') return { map, changed: false };
      {
        const next = cloneMap(map);
        next.tiles[op.row]![op.col] = 'empty';
        return { map: next, changed: true };
      }
    case 'paintRect': {
      const next = cloneMap(map);
      let changed = false;
      for (let r: number = op.rect.row; r < op.rect.row + op.rect.rows; r++) {
        for (let c: number = op.rect.col; c < op.rect.col + op.rect.cols; c++) {
          if (!inBounds(map, c, r)) continue;
          if (next.tiles[r]![c] !== op.kind) {
            next.tiles[r]![c] = op.kind;
            changed = true;
          }
        }
      }
      return { map: changed ? next : map, changed };
    }
    case 'fillTile': {
      if (!inBounds(map, op.col, op.row)) return { map, changed: false };
      const target = map.tiles[op.row]![op.col]!;
      if (target === op.kind) return { map, changed: false };
      const next = cloneMap(map);
      const stack: { c: number; r: number }[] = [{ c: op.col, r: op.row }];
      const seen = new Set<string>();
      while (stack.length) {
        const { c, r } = stack.pop()!;
        const key = `${c},${r}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (!inBounds(next, c, r)) continue;
        if (next.tiles[r]![c] !== target) continue;
        next.tiles[r]![c] = op.kind;
        stack.push({ c: c + 1, r });
        stack.push({ c: c - 1, r });
        stack.push({ c, r: r + 1 });
        stack.push({ c, r: r - 1 });
      }
      return { map: next, changed: true };
    }
    case 'placeEntity': {
      if (!inBounds(map, op.col, op.row)) return { map, changed: false };
      const next = cloneMap(map);
      next.entities = next.entities.filter((e) => !(e.tile.col === op.col && e.tile.row === op.row));
      next.entities.push({ kind: op.kind, tile: { col: op.col, row: op.row }, params: op.params });
      return { map: next, changed: true };
    }
    case 'removeEntityAt': {
      const before = map.entities.length;
      const next = cloneMap(map);
      next.entities = next.entities.filter((e) => !(e.tile.col === op.col && e.tile.row === op.row));
      return { map: next, changed: next.entities.length !== before };
    }
    case 'setSpawn': {
      if (!inBounds(map, op.col, op.row)) return { map, changed: false };
      const next = cloneMap(map);
      next.spawn = { col: op.col, row: op.row };
      return { map: next, changed: true };
    }
    case 'setGoal': {
      if (!inBounds(map, op.col, op.row)) return { map, changed: false };
      const next = cloneMap(map);
      next.goal = { col: op.col, row: op.row, kind: op.kind };
      return { map: next, changed: true };
    }
    case 'resizeMap': {
      if (op.cols === map.size.cols && op.rows === map.size.rows) return { map, changed: false };
      const next = cloneMap(map);
      const newTiles: TileKind[][] = Array.from({ length: op.rows }, (_, r) =>
        Array.from({ length: op.cols }, (_, c) => (
          r < map.size.rows && c < map.size.cols ? map.tiles[r]![c]! : 'empty'
        )),
      );
      next.size = { cols: op.cols, rows: op.rows };
      next.tiles = newTiles;
      next.entities = next.entities.filter((e) => e.tile.col < op.cols && e.tile.row < op.rows);
      if (next.spawn.col >= op.cols) next.spawn.col = op.cols - 1;
      if (next.spawn.row >= op.rows) next.spawn.row = op.rows - 1;
      if (next.goal.col >= op.cols) next.goal.col = op.cols - 1;
      if (next.goal.row >= op.rows) next.goal.row = op.rows - 1;
      return { map: next, changed: true };
    }
    case 'updateMetadata':
      // metadata is stored separately on the editor model; this op is a no-op
      // here but is preserved for symmetry.
      return { map, changed: false };
    default:
      return { map, changed: false };
  }
}
