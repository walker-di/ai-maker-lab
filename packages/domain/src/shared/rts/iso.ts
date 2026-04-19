export interface TilePos {
  col: number;
  row: number;
}

export interface IsoCoord {
  x: number;
  y: number;
}

export type AltitudeLevel = number;

export interface AltitudeMap {
  /** Indexed `[row][col]`. */
  levels: AltitudeLevel[][];
}
