import type { MapDefinition, TerrainKind, TilePos } from '../types.js';
import { getTerrainMetadata } from '../types.js';

/**
 * Authoritative tile lookup for terrain and altitude. Pure data + helpers; no
 * mutation outside `setTerrain`/`setAltitude` so simulation systems remain
 * deterministic.
 */
export class TileGrid {
  readonly cols: number;
  readonly rows: number;
  private readonly terrain: TerrainKind[][];
  private readonly altitude: number[][];

  constructor(map: MapDefinition) {
    this.cols = map.size.cols;
    this.rows = map.size.rows;
    this.terrain = map.terrain.map((row) => row.slice());
    this.altitude = map.altitude.levels.map((row) => row.slice());
  }

  inBounds(col: number, row: number): boolean {
    return col >= 0 && row >= 0 && col < this.cols && row < this.rows;
  }

  getTerrain(col: number, row: number): TerrainKind | null {
    if (!this.inBounds(col, row)) return null;
    return this.terrain[row]![col]!;
  }

  setTerrain(col: number, row: number, kind: TerrainKind): void {
    if (!this.inBounds(col, row)) return;
    this.terrain[row]![col] = kind;
  }

  getAltitude(col: number, row: number): number {
    if (!this.inBounds(col, row)) return 0;
    return this.altitude[row]![col]!;
  }

  setAltitude(col: number, row: number, value: number): void {
    if (!this.inBounds(col, row)) return;
    this.altitude[row]![col] = value;
  }

  isWalkable(col: number, row: number): boolean {
    const t = this.getTerrain(col, row);
    if (!t) return false;
    return getTerrainMetadata(t).walkable;
  }

  isBuildable(col: number, row: number): boolean {
    const t = this.getTerrain(col, row);
    if (!t) return false;
    return getTerrainMetadata(t).buildable;
  }

  altitudeDelta(a: TilePos, b: TilePos): number {
    return this.getAltitude(b.col, b.row) - this.getAltitude(a.col, a.row);
  }

  /** Shallow snapshot for renderer + minimap. */
  snapshot(): { terrain: TerrainKind[][]; altitude: number[][] } {
    return {
      terrain: this.terrain.map((r) => r.slice()),
      altitude: this.altitude.map((r) => r.slice()),
    };
  }
}
