import type { TileKind } from './tile-types.js';
import type { EntitySpawn } from './entity-types.js';

export type ScrollMode = 'horizontal' | 'free';

export type GoalKind = 'flag' | 'door' | 'edgeExit';

/** Warp when the player stands on `from` (a `pipeTop` tile) and holds down. */
export interface PipeTeleportLink {
  readonly from: { readonly col: number; readonly row: number };
  readonly to: { readonly col: number; readonly row: number };
}

export interface MapDefinition {
  id: string;
  version: number;
  size: { cols: number; rows: number };
  tileSize: number;
  scrollMode: ScrollMode;
  spawn: { col: number; row: number };
  goal: { col: number; row: number; kind: GoalKind };
  /** Ordered [row][col]. */
  tiles: TileKind[][];
  entities: EntitySpawn[];
  background: string;
  music: string;
  /** Optional pipe warps; `from` must reference a `pipeTop` cell. */
  pipeTeleports?: readonly PipeTeleportLink[];
}

export type MapSource = 'builtin' | 'user';

export interface MapMetadata {
  title: string;
  author: string;
  /** ISO 8601 */
  createdAt: string;
  /** ISO 8601 */
  updatedAt: string;
  source: MapSource;
  inheritsFromBuiltInId?: string;
}

export interface LevelDefinition {
  id: string;
  /** Display label such as `1-1`. */
  label: string;
  map: MapDefinition;
}

export interface WorldDefinition {
  id: string;
  label: string;
  levels: LevelDefinition[];
}
