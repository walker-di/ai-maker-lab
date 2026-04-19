/**
 * Local UI types mirror for the RTS feature.
 *
 * `packages/ui` cannot depend on `packages/domain` (see `packages/ui/AGENTS.md`).
 * This file mirrors the structural shape declared in
 * `packages/domain/src/shared/rts/`. Domain types satisfy these structurally
 * when passed in from the app layer.
 *
 * If you add or change a field in the shared domain, mirror it here in the
 * same change. Both files must stay structurally compatible.
 */

export interface TilePos {
  col: number;
  row: number;
}

/**
 * Generic 2D screen coordinate used by the projection. Named `IsoCoord` for
 * historical reasons; the active renderer is now top-down orthogonal so this
 * is just `{ x, y }` in pixel space.
 */
export interface IsoCoord {
  x: number;
  y: number;
}

export type AltitudeLevel = number;

export interface AltitudeMap {
  levels: AltitudeLevel[][];
}

export type TerrainKind = 'grass' | 'dirt' | 'rock' | 'water' | 'shallow' | 'cliff';

export const TERRAIN_KINDS: readonly TerrainKind[] = [
  'grass',
  'dirt',
  'rock',
  'water',
  'shallow',
  'cliff',
];

export interface TerrainMetadata {
  readonly walkable: boolean;
  readonly buildable: boolean;
  readonly swimmable: boolean;
  readonly blocksVision: boolean;
  readonly blocksProjectiles: boolean;
}

const TERRAIN_METADATA: Readonly<Record<TerrainKind, TerrainMetadata>> = {
  grass:   { walkable: true,  buildable: true,  swimmable: false, blocksVision: false, blocksProjectiles: false },
  dirt:    { walkable: true,  buildable: true,  swimmable: false, blocksVision: false, blocksProjectiles: false },
  rock:    { walkable: true,  buildable: true,  swimmable: false, blocksVision: false, blocksProjectiles: false },
  water:   { walkable: false, buildable: false, swimmable: true,  blocksVision: false, blocksProjectiles: false },
  shallow: { walkable: true,  buildable: false, swimmable: true,  blocksVision: false, blocksProjectiles: false },
  cliff:   { walkable: false, buildable: false, swimmable: false, blocksVision: true,  blocksProjectiles: true  },
};

export function getTerrainMetadata(kind: TerrainKind): TerrainMetadata {
  return TERRAIN_METADATA[kind];
}

export type ResourceKind = 'mineral' | 'gas';

export interface ResourceNode {
  id: string;
  kind: ResourceKind;
  tile: TilePos;
  amount: number;
  regenPerMin?: number;
}

export type UnitKind = 'worker' | 'rifleman' | 'rocket' | 'scout';
export type BuildingKind = 'hq' | 'barracks' | 'factory' | 'refinery' | 'depot' | 'turret';
export type TechKind = 'armorT1' | 'armorT2' | 'weaponT1' | 'weaponT2' | 'sightRange';

export interface ResourceCost {
  mineral: number;
  gas: number;
}

export interface UnitStats {
  cost: ResourceCost;
  buildTimeMs: number;
  supply: number;
  hp: number;
  armor: number;
  sight: number;
  speed: number;
  range: number;
  damage: number;
  attackPeriodMs: number;
  arc: 'direct' | 'parabolic';
  projectileKind: 'bullet' | 'rocket' | 'tracer';
  cargoCapacity?: number;
  gatherCycleMs?: number;
}

export interface BuildingStats {
  cost: ResourceCost;
  buildTimeMs: number;
  supply: number;
  hp: number;
  armor: number;
  sight: number;
  footprint: { cols: number; rows: number };
  supplyProvided?: number;
  canTrain?: UnitKind[];
  canResearch?: TechKind[];
  combat?: {
    range: number;
    damage: number;
    attackPeriodMs: number;
    arc: 'direct' | 'parabolic';
    projectileKind: 'bullet' | 'rocket' | 'tracer';
  };
}

export const UNIT_STATS: Readonly<Record<UnitKind, UnitStats>> = {
  worker: {
    cost: { mineral: 50, gas: 0 },
    buildTimeMs: 12_000,
    supply: 1,
    hp: 40, armor: 0, sight: 8,
    speed: 2.4, range: 0, damage: 4,
    attackPeriodMs: 1200, arc: 'direct', projectileKind: 'tracer',
    cargoCapacity: 8, gatherCycleMs: 2_000,
  },
  rifleman: {
    cost: { mineral: 60, gas: 0 },
    buildTimeMs: 16_000,
    supply: 1,
    hp: 60, armor: 0, sight: 9,
    speed: 2.0, range: 5, damage: 8,
    attackPeriodMs: 900, arc: 'direct', projectileKind: 'bullet',
  },
  rocket: {
    cost: { mineral: 80, gas: 40 },
    buildTimeMs: 22_000,
    supply: 2,
    hp: 70, armor: 0, sight: 9,
    speed: 1.6, range: 7, damage: 22,
    attackPeriodMs: 1800, arc: 'parabolic', projectileKind: 'rocket',
  },
  scout: {
    cost: { mineral: 50, gas: 0 },
    buildTimeMs: 10_000,
    supply: 1,
    hp: 35, armor: 0, sight: 12,
    speed: 3.4, range: 3, damage: 4,
    attackPeriodMs: 1100, arc: 'direct', projectileKind: 'tracer',
  },
};

export const BUILDING_STATS: Readonly<Record<BuildingKind, BuildingStats>> = {
  hq: {
    cost: { mineral: 400, gas: 0 }, buildTimeMs: 60_000, supply: 0,
    hp: 600, armor: 2, sight: 12,
    footprint: { cols: 3, rows: 3 }, supplyProvided: 8,
    canTrain: ['worker'], canResearch: ['armorT1', 'armorT2', 'weaponT1', 'weaponT2', 'sightRange'],
  },
  barracks: {
    cost: { mineral: 150, gas: 0 }, buildTimeMs: 30_000, supply: 0,
    hp: 250, armor: 1, sight: 8,
    footprint: { cols: 2, rows: 2 }, canTrain: ['rifleman', 'scout'],
  },
  factory: {
    cost: { mineral: 200, gas: 100 }, buildTimeMs: 40_000, supply: 0,
    hp: 350, armor: 1, sight: 8,
    footprint: { cols: 3, rows: 2 }, canTrain: ['rocket'],
  },
  refinery: {
    cost: { mineral: 100, gas: 0 }, buildTimeMs: 20_000, supply: 0,
    hp: 200, armor: 1, sight: 6,
    footprint: { cols: 2, rows: 2 },
  },
  depot: {
    cost: { mineral: 100, gas: 0 }, buildTimeMs: 18_000, supply: 0,
    hp: 200, armor: 1, sight: 6,
    footprint: { cols: 2, rows: 2 }, supplyProvided: 8,
  },
  turret: {
    cost: { mineral: 100, gas: 0 }, buildTimeMs: 22_000, supply: 0,
    hp: 180, armor: 1, sight: 9,
    footprint: { cols: 1, rows: 1 },
    combat: { range: 6, damage: 12, attackPeriodMs: 1000, arc: 'direct', projectileKind: 'bullet' },
  },
};

export const TUNABLES = {
  basePathStepCost: 1,
  slopePenalty: 0.5,
  maxStep: 1,
  altitudeRangeBonusPerLevel: 1,
  altitudeDamageBonusPerLevel: 0.1,
  lowerToHigherMissChance: 0.15,
  edgePanThresholdPx: 24,
  defaultStartingResources: { mineral: 100, gas: 0 } as ResourceCost,
  defaultPopulationCap: 12,
  defaultDepotSupply: 8,
} as const;

export type AiDifficulty = 'easy' | 'normal' | 'hard';

export interface Faction {
  id: string;
  label: string;
  color: string;
  isPlayer: boolean;
  isAi: boolean;
  aiDifficulty?: AiDifficulty;
}

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
  tileSize: { width: number; height: number };
  maxAltitude: number;
  terrain: TerrainKind[][];
  altitude: AltitudeMap;
  resources: ResourceNode[];
  spawns: { factionId: string; tile: TilePos }[];
  metadata: MapMetadata;
}

export interface MatchRules {
  startingResources: ResourceCost;
  populationCap: number;
  fogOfWar: boolean;
  aiDifficulty: AiDifficulty;
  rngSeed: number;
}

export interface MatchDefinition {
  id: string;
  mapId: string;
  factions: Faction[];
  rules: MatchRules;
}

export interface MatchResult {
  matchId: string;
  mapId: string;
  winner: string;
  durationMs: number;
  factions: Faction[];
  finishedAt: string;
}

export interface ResolvedRtsMap {
  id: string;
  metadata: MapMetadata;
  definition: MapDefinition;
  source: 'builtin' | 'user' | 'generated';
  builtInId?: string;
  isEditable: boolean;
}

export type MapArchetype = 'open-field' | 'cliffs-and-ramps' | 'island-shores';
export type SymmetryMode = 'mirrorH' | 'mirrorV' | 'rotational180' | 'none';
export type ResourceDensity = 'sparse' | 'normal' | 'rich';
export type AltitudeRoughness = 'flat' | 'rolling' | 'rugged';

export interface MapGenerationParams {
  seed: number;
  archetype: MapArchetype;
  size: { cols: number; rows: number };
  maxAltitude: number;
  factionCount: number;
  symmetry: SymmetryMode;
  resourceDensity: ResourceDensity;
  altitudeRoughness: AltitudeRoughness;
  waterAmount: number;
  ramps: number;
  version: number;
  spawnOrderSalt?: number;
  resourceAmountMultiplier?: number;
}

export interface UserMapRecord {
  id: string;
  ownerId?: string;
  definition: MapDefinition;
  params?: MapGenerationParams;
  metadata: MapMetadata;
}
