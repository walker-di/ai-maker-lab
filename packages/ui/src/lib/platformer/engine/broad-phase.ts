import type { AABB } from './aabb.js';

/**
 * Tile-column partition for cheap horizontal-strip queries against dynamic
 * entity AABBs. Rebuilt each fixed step in the integration system.
 */
export class BroadPhase<T> {
  private readonly columns: Map<number, T[]> = new Map();

  constructor(private readonly tileSize: number) {}

  reset(): void {
    this.columns.clear();
  }

  insert(item: T, box: AABB): void {
    const minCol = Math.floor(box.x / this.tileSize);
    const maxCol = Math.ceil((box.x + box.width) / this.tileSize) - 1;
    for (let col = minCol; col <= maxCol; col++) {
      let bucket = this.columns.get(col);
      if (!bucket) {
        bucket = [];
        this.columns.set(col, bucket);
      }
      bucket.push(item);
    }
  }

  query(box: AABB): T[] {
    const minCol = Math.floor(box.x / this.tileSize);
    const maxCol = Math.ceil((box.x + box.width) / this.tileSize) - 1;
    const seen = new Set<T>();
    const results: T[] = [];
    for (let col = minCol; col <= maxCol; col++) {
      const bucket = this.columns.get(col);
      if (!bucket) continue;
      for (const item of bucket) {
        if (!seen.has(item)) {
          seen.add(item);
          results.push(item);
        }
      }
    }
    return results;
  }
}
