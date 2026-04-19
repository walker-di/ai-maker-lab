import type { TilePos } from '../types.js';
import { TUNABLES } from '../types.js';
import type { TileGrid } from './tile-grid.js';

interface Node {
  col: number;
  row: number;
  g: number;
  f: number;
  parent: Node | null;
}

const NEIGHBORS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [-1, 1], [1, -1], [-1, -1],
] as const;

/**
 * 8-direction A* with altitude penalties. `maxStep` controls how steep a
 * tile-to-tile altitude delta a unit can climb. Falling onto cliff tiles is
 * disallowed because cliff tiles aren't walkable. Returns `null` if no path.
 */
export function findPath(grid: TileGrid, start: TilePos, goal: TilePos, maxStep = TUNABLES.maxStep): TilePos[] | null {
  if (!grid.isWalkable(start.col, start.row)) return null;
  if (!grid.isWalkable(goal.col, goal.row)) return null;
  const open: Node[] = [];
  const closed = new Set<string>();
  const seen = new Map<string, Node>();
  const startNode: Node = { col: start.col, row: start.row, g: 0, f: heur(start, goal), parent: null };
  open.push(startNode);
  seen.set(key(start.col, start.row), startNode);

  while (open.length > 0) {
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) if (open[i]!.f < open[bestIdx]!.f) bestIdx = i;
    const current = open.splice(bestIdx, 1)[0]!;
    const ck = key(current.col, current.row);
    if (current.col === goal.col && current.row === goal.row) {
      return reconstruct(current);
    }
    closed.add(ck);

    for (const [dc, dr] of NEIGHBORS) {
      const ncol = current.col + dc;
      const nrow = current.row + dr;
      const nk = key(ncol, nrow);
      if (closed.has(nk)) continue;
      if (!grid.isWalkable(ncol, nrow)) continue;
      const altitudeDelta = Math.abs(grid.getAltitude(ncol, nrow) - grid.getAltitude(current.col, current.row));
      if (altitudeDelta > maxStep) continue;
      const stepCost = (dc !== 0 && dr !== 0 ? 1.41 : 1) + altitudeDelta * TUNABLES.slopePenalty;
      const tentativeG = current.g + stepCost;
      const existing = seen.get(nk);
      if (!existing || tentativeG < existing.g) {
        const node: Node = { col: ncol, row: nrow, g: tentativeG, f: tentativeG + heur({ col: ncol, row: nrow }, goal), parent: current };
        if (!existing) open.push(node);
        else {
          existing.g = node.g;
          existing.f = node.f;
          existing.parent = current;
        }
        seen.set(nk, node);
      }
    }
  }
  return null;
}

function heur(a: TilePos, b: TilePos): number {
  const dx = Math.abs(a.col - b.col);
  const dy = Math.abs(a.row - b.row);
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
}

function key(col: number, row: number): string {
  return `${col}:${row}`;
}

function reconstruct(node: Node): TilePos[] {
  const out: TilePos[] = [];
  let cur: Node | null = node;
  while (cur) {
    out.push({ col: cur.col, row: cur.row });
    cur = cur.parent;
  }
  return out.reverse();
}
