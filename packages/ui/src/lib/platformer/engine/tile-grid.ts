import type { MapDefinition, TileKind } from '../types.js';
import { getTileMetadata } from '../types.js';
import type { AABB } from './aabb.js';

export interface TileOverlap {
  col: number;
  row: number;
  kind: TileKind;
}

export class TileGrid {
  readonly cols: number;
  readonly rows: number;
  readonly tileSize: number;
  private readonly tiles: TileKind[][];

  constructor(map: MapDefinition) {
    this.cols = map.size.cols;
    this.rows = map.size.rows;
    this.tileSize = map.tileSize;
    this.tiles = map.tiles.map((row) => [...row]);
  }

  inBounds(col: number, row: number): boolean {
    return col >= 0 && row >= 0 && col < this.cols && row < this.rows;
  }

  tileAt(col: number, row: number): TileKind {
    if (!this.inBounds(col, row)) {
      return 'empty';
    }
    return this.tiles[row]![col]!;
  }

  setTile(col: number, row: number, kind: TileKind): void {
    if (!this.inBounds(col, row)) {
      return;
    }
    this.tiles[row]![col] = kind;
  }

  solidAt(col: number, row: number): boolean {
    return getTileMetadata(this.tileAt(col, row)).solid;
  }

  oneWayAt(col: number, row: number): boolean {
    return getTileMetadata(this.tileAt(col, row)).oneWay;
  }

  bumpableAt(col: number, row: number): boolean {
    return getTileMetadata(this.tileAt(col, row)).bumpable;
  }

  hazardousAt(col: number, row: number): boolean {
    return getTileMetadata(this.tileAt(col, row)).hazardous;
  }

  forEachOverlap(box: AABB, fn: (overlap: TileOverlap) => void): void {
    // AABBs use half-open ranges: a box at y..y+h only overlaps a tile when the
    // tile's interval (tileTop, tileTop+tileSize) intersects (box.y, box.y+box.h).
    // Using `ceil((x+w)/size) - 1` excludes a tile whose top edge equals the
    // box's bottom edge (a player exactly grounded on a floor).
    const minCol = Math.max(0, Math.floor(box.x / this.tileSize));
    const maxCol = Math.min(this.cols - 1, Math.ceil((box.x + box.width) / this.tileSize) - 1);
    const minRow = Math.max(0, Math.floor(box.y / this.tileSize));
    const maxRow = Math.min(this.rows - 1, Math.ceil((box.y + box.height) / this.tileSize) - 1);

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        fn({ col, row, kind: this.tiles[row]![col]! });
      }
    }
  }

  cloneTiles(): TileKind[][] {
    return this.tiles.map((row) => [...row]);
  }
}
