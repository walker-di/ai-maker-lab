import type { IsoCoord, TilePos } from '../types.js';

/**
 * Classic 2:1 iso projection. `tileSize.width` is full diamond width and
 * `tileSize.height` is full diamond height (typically 64x32). Altitude
 * shifts the screen-space y by `altitudeStep` per level so cliffs read.
 */
export interface IsoProjectionConfig {
  tileSize: { width: number; height: number };
  altitudeStep: number;
  /** Origin offset applied to all projected coordinates. */
  originX: number;
  originY: number;
}

export class IsoProjection {
  constructor(public readonly config: IsoProjectionConfig) {}

  tileToIso(tile: TilePos, altitude = 0): IsoCoord {
    const { tileSize, originX, originY, altitudeStep } = this.config;
    const halfW = tileSize.width / 2;
    const halfH = tileSize.height / 2;
    const x = (tile.col - tile.row) * halfW + originX;
    const y = (tile.col + tile.row) * halfH + originY - altitude * altitudeStep;
    return { x, y };
  }

  /**
   * Convert from world iso (already including origin) to tile coordinates.
   * Altitude is approximate; the renderer should hit-test from the highest
   * altitude downward when stacking matters.
   */
  isoToTile(coord: IsoCoord): TilePos {
    const { tileSize, originX, originY } = this.config;
    const halfW = tileSize.width / 2;
    const halfH = tileSize.height / 2;
    const x = coord.x - originX;
    const y = coord.y - originY;
    return {
      col: Math.floor((x / halfW + y / halfH) / 2),
      row: Math.floor((y / halfH - x / halfW) / 2),
    };
  }

  setOrigin(x: number, y: number): void {
    this.config.originX = x;
    this.config.originY = y;
  }
}
