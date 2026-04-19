import type { IsoCoord, TilePos } from '../types.js';

/**
 * Flat top-down orthogonal projection. `tileSize.width` and
 * `tileSize.height` are pixel dimensions of a single square tile. Altitude
 * is conveyed in screen space by lifting the rendered tile up by
 * `altitudeStep` pixels per level so cliffs and ramps read visually
 * without leaving the orthogonal grid.
 *
 * The file name is kept as `iso.ts` for git history continuity, but the
 * projection is no longer isometric.
 */
export interface OrthoProjectionConfig {
  tileSize: { width: number; height: number };
  altitudeStep: number;
  /** Origin offset applied to all projected coordinates. */
  originX: number;
  originY: number;
}

export class OrthoProjection {
  constructor(public readonly config: OrthoProjectionConfig) {}

  /** Map a tile (and altitude) to top-left screen coordinates of the tile. */
  tileToScreen(tile: TilePos, altitude = 0): IsoCoord {
    const { tileSize, originX, originY, altitudeStep } = this.config;
    return {
      x: originX + tile.col * tileSize.width,
      y: originY + tile.row * tileSize.height - altitude * altitudeStep,
    };
  }

  /**
   * Inverse of `tileToScreen`. `altitude` should be the altitude of the
   * tile being hit-tested; defaults to 0 which is correct for a flat map
   * and a good approximation when callers don't know the altitude yet.
   */
  screenToTile(coord: IsoCoord, altitude = 0): TilePos {
    const { tileSize, originX, originY, altitudeStep } = this.config;
    const adjustedY = coord.y + altitude * altitudeStep;
    return {
      col: Math.floor((coord.x - originX) / tileSize.width),
      row: Math.floor((adjustedY - originY) / tileSize.height),
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
