import type { AltitudeMap, TilePos } from './iso.js';
import type { ResourceNode } from './resources.js';
import type { TerrainKind } from './terrain.js';

export type MapSource = 'builtin' | 'user' | 'generated';

export interface MapMetadata {
  title: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  source: MapSource;
}

export interface MapDefinition {
  id: string;
  version: number;
  size: { cols: number; rows: number };
  /** Default 64x32. */
  tileSize: { width: number; height: number };
  maxAltitude: number;
  /** Indexed `[row][col]`. */
  terrain: TerrainKind[][];
  altitude: AltitudeMap;
  resources: ResourceNode[];
  spawns: { factionId: string; tile: TilePos }[];
  metadata: MapMetadata;
}
