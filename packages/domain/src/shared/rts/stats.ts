import type { BuildingKind, TechKind, UnitKind } from './units.js';

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
  /** Builders only. */
  cargoCapacity?: number;
  /** Workers only — cycle to harvest one full cargo's worth. */
  gatherCycleMs?: number;
}

export interface BuildingStats {
  cost: ResourceCost;
  buildTimeMs: number;
  supply: number;
  hp: number;
  armor: number;
  sight: number;
  /** Footprint in tiles. */
  footprint: { cols: number; rows: number };
  /** Adds this much to supply cap when constructed. */
  supplyProvided?: number;
  /** Whether this building can train units. */
  canTrain?: UnitKind[];
  /** Whether this building can research tech. */
  canResearch?: TechKind[];
  /** Combat properties when applicable (e.g. turret). */
  combat?: {
    range: number;
    damage: number;
    attackPeriodMs: number;
    arc: 'direct' | 'parabolic';
    projectileKind: 'bullet' | 'rocket' | 'tracer';
  };
}

export interface TechStats {
  cost: ResourceCost;
  researchTimeMs: number;
  /** Default home for research is `hq`. */
  researchedAt: BuildingKind;
}

export const UNIT_STATS: Readonly<Record<UnitKind, UnitStats>> = {
  worker: {
    cost: { mineral: 50, gas: 0 },
    buildTimeMs: 12_000,
    supply: 1,
    hp: 40,
    armor: 0,
    sight: 8,
    speed: 2.4,
    range: 0,
    damage: 4,
    attackPeriodMs: 1200,
    arc: 'direct',
    projectileKind: 'tracer',
    cargoCapacity: 8,
    gatherCycleMs: 2_000,
  },
  rifleman: {
    cost: { mineral: 60, gas: 0 },
    buildTimeMs: 16_000,
    supply: 1,
    hp: 60,
    armor: 0,
    sight: 9,
    speed: 2.0,
    range: 5,
    damage: 8,
    attackPeriodMs: 900,
    arc: 'direct',
    projectileKind: 'bullet',
  },
  rocket: {
    cost: { mineral: 80, gas: 40 },
    buildTimeMs: 22_000,
    supply: 2,
    hp: 70,
    armor: 0,
    sight: 9,
    speed: 1.6,
    range: 7,
    damage: 22,
    attackPeriodMs: 1800,
    arc: 'parabolic',
    projectileKind: 'rocket',
  },
  scout: {
    cost: { mineral: 50, gas: 0 },
    buildTimeMs: 10_000,
    supply: 1,
    hp: 35,
    armor: 0,
    sight: 12,
    speed: 3.4,
    range: 3,
    damage: 4,
    attackPeriodMs: 1100,
    arc: 'direct',
    projectileKind: 'tracer',
  },
};

export const BUILDING_STATS: Readonly<Record<BuildingKind, BuildingStats>> = {
  hq: {
    cost: { mineral: 400, gas: 0 },
    buildTimeMs: 60_000,
    supply: 0,
    hp: 600,
    armor: 2,
    sight: 12,
    footprint: { cols: 3, rows: 3 },
    supplyProvided: 8,
    canTrain: ['worker'],
    canResearch: ['armorT1', 'armorT2', 'weaponT1', 'weaponT2', 'sightRange'],
  },
  barracks: {
    cost: { mineral: 150, gas: 0 },
    buildTimeMs: 30_000,
    supply: 0,
    hp: 250,
    armor: 1,
    sight: 8,
    footprint: { cols: 2, rows: 2 },
    canTrain: ['rifleman', 'scout'],
  },
  factory: {
    cost: { mineral: 200, gas: 100 },
    buildTimeMs: 40_000,
    supply: 0,
    hp: 350,
    armor: 1,
    sight: 8,
    footprint: { cols: 3, rows: 2 },
    canTrain: ['rocket'],
  },
  refinery: {
    cost: { mineral: 100, gas: 0 },
    buildTimeMs: 20_000,
    supply: 0,
    hp: 200,
    armor: 1,
    sight: 6,
    footprint: { cols: 2, rows: 2 },
  },
  depot: {
    cost: { mineral: 100, gas: 0 },
    buildTimeMs: 18_000,
    supply: 0,
    hp: 200,
    armor: 1,
    sight: 6,
    footprint: { cols: 2, rows: 2 },
    supplyProvided: 8,
  },
  turret: {
    cost: { mineral: 100, gas: 0 },
    buildTimeMs: 22_000,
    supply: 0,
    hp: 180,
    armor: 1,
    sight: 9,
    footprint: { cols: 1, rows: 1 },
    combat: {
      range: 6,
      damage: 12,
      attackPeriodMs: 1000,
      arc: 'direct',
      projectileKind: 'bullet',
    },
  },
};

export const TECH_STATS: Readonly<Record<TechKind, TechStats>> = {
  armorT1:    { cost: { mineral: 100, gas: 50 },  researchTimeMs: 30_000, researchedAt: 'hq' },
  armorT2:    { cost: { mineral: 175, gas: 100 }, researchTimeMs: 45_000, researchedAt: 'hq' },
  weaponT1:   { cost: { mineral: 100, gas: 50 },  researchTimeMs: 30_000, researchedAt: 'hq' },
  weaponT2:   { cost: { mineral: 175, gas: 100 }, researchTimeMs: 45_000, researchedAt: 'hq' },
  sightRange: { cost: { mineral: 75,  gas: 25 },  researchTimeMs: 25_000, researchedAt: 'hq' },
};

export const TUNABLES = {
  basePathStepCost: 1,
  slopePenalty: 0.5,
  /** Maximum altitude delta a ground unit can step in a single hop. */
  maxStep: 1,
  altitudeRangeBonusPerLevel: 1,
  altitudeDamageBonusPerLevel: 0.1,
  lowerToHigherMissChance: 0.15,
  edgePanThresholdPx: 24,
  defaultStartingResources: { mineral: 100, gas: 0 } as ResourceCost,
  defaultPopulationCap: 12,
  /** Default depot bonus; UNIT_STATS supply caps are enforced by `WorkerSystem`. */
  defaultDepotSupply: 8,
} as const;

export type Tunables = typeof TUNABLES;
