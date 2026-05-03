import type { IsoCoord, TilePos } from '../types.js';

/** 2:1 isometric projection. `tileSize` is the diamond's bounding box. */
export interface OrthoProjectionConfig {
  tileSize: { width: number; height: number };
  altitudeStep: number;
  /** Origin offset applied to all projected coordinates. */
  originX: number;
  originY: number;
}

export class OrthoProjection {
  constructor(public readonly config: OrthoProjectionConfig) {}

  /** Map a tile (and altitude) to the center of the tile diamond. */
  tileToScreen(tile: TilePos, altitude = 0): IsoCoord {
    const { tileSize, originX, originY, altitudeStep } = this.config;
    return {
      x: originX + (tile.col - tile.row) * (tileSize.width / 2),
      y: originY + (tile.col + tile.row) * (tileSize.height / 2) - altitude * altitudeStep,
    };
  }

  /**
   * Inverse of `tileToScreen`. `altitude` should be the altitude of the
   * tile being hit-tested; defaults to 0 which is correct for a flat map
   * and a good approximation when callers don't know the altitude yet.
   */
  screenToTile(coord: IsoCoord, altitude = 0): TilePos {
    const { tileSize, originX, originY, altitudeStep } = this.config;
    const localX = (coord.x - originX) / (tileSize.width / 2);
    const localY = (coord.y - originY + altitude * altitudeStep) / (tileSize.height / 2);
    return {
      col: Math.floor((localX + localY) / 2),
      row: Math.floor((localY - localX) / 2),
    };
  }

  setOrigin(x: number, y: number): void {
    this.config.originX = x;
    this.config.originY = y;
  }
}

/** @deprecated Renamed to `OrthoProjection`; kept as a re-export shim. */
export const IsoProjection = OrthoProjection;
/** @deprecated Renamed to `OrthoProjectionConfig`. */
export type IsoProjectionConfig = OrthoProjectionConfig;
