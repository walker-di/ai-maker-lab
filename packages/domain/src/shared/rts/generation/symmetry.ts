import type { TilePos } from '../iso.js';

export type SymmetryMode = 'mirrorH' | 'mirrorV' | 'rotational180' | 'none';

export const SYMMETRY_MODES: readonly SymmetryMode[] = ['mirrorH', 'mirrorV', 'rotational180', 'none'];

export function mirrorTile(
  tile: TilePos,
  mode: SymmetryMode,
  size: { cols: number; rows: number },
): TilePos {
  const cols = size.cols;
  const rows = size.rows;
  switch (mode) {
    case 'mirrorH':
      return { col: cols - 1 - tile.col, row: tile.row };
    case 'mirrorV':
      return { col: tile.col, row: rows - 1 - tile.row };
    case 'rotational180':
      return { col: cols - 1 - tile.col, row: rows - 1 - tile.row };
    case 'none':
      return tile;
  }
}
