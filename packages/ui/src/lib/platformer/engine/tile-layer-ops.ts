import type { TileKind } from '../types.js';

export type TileCellUpdate = { col: number; row: number; kind: TileKind };

export function cloneTileGrid(tiles: readonly (readonly TileKind[])[]): TileKind[][] {
  return tiles.map((row) => [...row]);
}

export function applyTileCellUpdates(grid: TileKind[][], updates: readonly TileCellUpdate[]): void {
  for (const u of updates) {
    const row = grid[u.row];
    if (!row) continue;
    row[u.col] = u.kind;
  }
}
