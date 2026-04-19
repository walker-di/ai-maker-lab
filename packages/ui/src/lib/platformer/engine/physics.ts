import type { AABB } from './aabb.js';
import type { TileGrid } from './tile-grid.js';
import { getTileMetadata } from '../types.js';
import type { TileKind } from '../types.js';

export interface CollisionEvent {
  type: 'tile-bumped' | 'hazard';
  col: number;
  row: number;
  kind: TileKind;
}

export interface SweepResult {
  newX: number;
  newY: number;
  collidedX: boolean;
  collidedY: boolean;
  /** Y collision moving up triggers a head bump. */
  bumpedHead: boolean;
  events: CollisionEvent[];
}

/**
 * Axis-separated sweep against a static tile grid. Resolves X first, then Y.
 * One-way platforms only collide when descending and the previous bottom was
 * above the platform top.
 */
export function sweepAABB(
  box: AABB,
  vx: number,
  vy: number,
  prevBottom: number,
  grid: TileGrid,
): SweepResult {
  const events: CollisionEvent[] = [];
  let newX = box.x + vx;
  let collidedX = false;
  let collidedY = false;
  let bumpedHead = false;

  // X axis sweep.
  const yBox: AABB = { x: newX, y: box.y, width: box.width, height: box.height };
  grid.forEachOverlap(yBox, ({ col, row, kind }) => {
    const meta = getTileMetadata(kind);
    if (!meta.solid || meta.oneWay) return;
    if (vx > 0) {
      // Player moving right; push back to left edge of tile.
      const tileLeft = col * grid.tileSize;
      newX = Math.min(newX, tileLeft - box.width);
      collidedX = true;
    } else if (vx < 0) {
      const tileRight = (col + 1) * grid.tileSize;
      newX = Math.max(newX, tileRight);
      collidedX = true;
    }
  });

  // Y axis sweep.
  let newY = box.y + vy;
  const fullBox: AABB = { x: newX, y: newY, width: box.width, height: box.height };
  grid.forEachOverlap(fullBox, ({ col, row, kind }) => {
    const meta = getTileMetadata(kind);
    if (meta.hazardous) {
      events.push({ type: 'hazard', col, row, kind });
      return;
    }
    if (!meta.solid && !meta.oneWay) return;
    if (vy > 0) {
      // Falling: land on top.
      const tileTop = row * grid.tileSize;
      if (meta.oneWay) {
        if (prevBottom > tileTop) return; // pass through if already below the surface
      }
      if (newY + box.height > tileTop) {
        newY = tileTop - box.height;
        collidedY = true;
      }
    } else if (vy < 0 && meta.solid && !meta.oneWay) {
      const tileBottom = (row + 1) * grid.tileSize;
      if (newY < tileBottom) {
        newY = tileBottom;
        collidedY = true;
        bumpedHead = true;
        if (meta.bumpable) {
          events.push({ type: 'tile-bumped', col, row, kind });
        }
      }
    }
  });

  return { newX, newY, collidedX, collidedY, bumpedHead, events };
}
