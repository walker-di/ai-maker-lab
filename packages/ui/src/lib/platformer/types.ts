/**
 * Local UI types mirror for the platformer feature.
 *
 * `packages/ui` cannot depend on `packages/domain` (see `packages/ui/AGENTS.md`).
 * This file mirrors the structural shape declared in
 * `packages/domain/src/shared/platformer/`. Domain types satisfy these
 * structurally when passed from the app layer, mirroring the chat UI rule.
 *
 * If you add or change a field in the shared domain, mirror it here in the
 * same change. Both files must stay structurally compatible.
 */

export type TileKind =
  | 'empty'
  | 'ground'
  | 'brick'
  | 'question'
  | 'hardBlock'
  | 'pipeTop'
  | 'pipeBody'
  | 'flagPole'
  | 'flagBase'
  | 'coinTile'
  | 'hazard';

export const TILE_KINDS: readonly TileKind[] = [
  'empty',
  'ground',
  'brick',
  'question',
  'hardBlock',
  'pipeTop',
  'pipeBody',
  'flagPole',
  'flagBase',
  'coinTile',
  'hazard',
];

export interface TileMetadata {
  readonly solid: boolean;
  readonly breakable: boolean;
  readonly bumpable: boolean;
  readonly oneWay: boolean;
  readonly hazardous: boolean;
}

const TILE_METADATA: Readonly<Record<TileKind, TileMetadata>> = {
  empty:     { solid: false, breakable: false, bumpable: false, oneWay: false, hazardous: false },
  ground:    { solid: true,  breakable: false, bumpable: false, oneWay: false, hazardous: false },
  brick:     { solid: true,  breakable: true,  bumpable: true,  oneWay: false, hazardous: false },
  question:  { solid: true,  breakable: false, bumpable: true,  oneWay: false, hazardous: false },
  hardBlock: { solid: true,  breakable: false, bumpable: false, oneWay: false, hazardous: false },
  pipeTop:   { solid: true,  breakable: false, bumpable: false, oneWay: false, hazardous: false },
  pipeBody:  { solid: true,  breakable: false, bumpable: false, oneWay: false, hazardous: false },
  flagPole:  { solid: false, breakable: false, bumpable: false, oneWay: false, hazardous: false },
  flagBase:  { solid: true,  breakable: false, bumpable: false, oneWay: false, hazardous: false },
  coinTile:  { solid: false, breakable: false, bumpable: false, oneWay: false, hazardous: false },
  hazard:    { solid: false, breakable: false, bumpable: false, oneWay: false, hazardous: true  },
};

export function getTileMetadata(kind: TileKind): TileMetadata {
  return TILE_METADATA[kind];
}

export function isSolidTile(kind: TileKind): boolean {
  return TILE_METADATA[kind].solid;
}

export type EntityKind =
  | 'player'
  | 'walkerEnemy'
  | 'shellEnemy'
  | 'flyingEnemy'
  | 'fireBar'
  | 'bulletShooter'
  | 'coin'
  | 'mushroom'
  | 'flower'
  | 'star'
  | 'oneUp'
  | 'platformMoving'
  | 'spring';

export const ENTITY_KINDS: readonly EntityKind[] = [
  'player',
  'walkerEnemy',
  'shellEnemy',
  'flyingEnemy',
  'fireBar',
  'bulletShooter',
  'coin',
  'mushroom',
  'flower',
  'star',
  'oneUp',
  'platformMoving',
  'spring',
];

export const PLACEABLE_ENTITY_KINDS: readonly EntityKind[] = ENTITY_KINDS.filter(
  (kind) => kind !== 'player',
);

export type EntityParamValue = number | string | boolean;

export interface EntitySpawn {
  readonly kind: EntityKind;
  readonly tile: { readonly col: number; readonly row: number };
  readonly params?: Readonly<Record<string, EntityParamValue>>;
}

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
  createdAt: string;
  updatedAt: string;
  source: MapSource;
  inheritsFromBuiltInId?: string;
}

export interface LevelDefinition {
  id: string;
  label: string;
  map: MapDefinition;
}

export interface WorldDefinition {
  id: string;
  label: string;
  levels: LevelDefinition[];
}

export type PowerUpKind = 'none' | 'grow' | 'fire' | 'star';

export interface PlayerProfile {
  lives: number;
  score: number;
  coins: number;
  power: PowerUpKind;
  checkpoint?: { worldId: string; levelId: string };
}

export interface ResolvedMapEntry {
  id: string;
  metadata: MapMetadata;
  definition: MapDefinition;
  source: 'builtin' | 'user';
  builtInId?: string;
  inheritsFromBuiltInId?: string;
  isEditable: boolean;
}

export type RunOutcome = 'completed' | 'gameOver';

export interface RunResult {
  worldId: string;
  levelId: string;
  outcome: RunOutcome;
  score: number;
  coins: number;
  timeMs: number;
  completedAt: string;
}

export interface MapValidationIssue {
  code: string;
  message: string;
  cell?: { col: number; row: number };
}

export interface MapValidationResult {
  ok: boolean;
  errors: MapValidationIssue[];
  warnings: MapValidationIssue[];
}
