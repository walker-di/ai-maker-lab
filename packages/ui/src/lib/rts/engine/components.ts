import type { BuildingKind, ResourceCost, ResourceKind, TilePos, UnitKind } from '../types.js';

export const COMPONENT_KINDS = {
  position: 'rts.position',
  velocity: 'rts.velocity',
  unit: 'rts.unit',
  building: 'rts.building',
  resourceNode: 'rts.resourceNode',
  combat: 'rts.combat',
  health: 'rts.health',
  vision: 'rts.vision',
  selectable: 'rts.selectable',
  faction: 'rts.faction',
  movement: 'rts.movement',
  worker: 'rts.worker',
  productionQueue: 'rts.productionQueue',
  projectile: 'rts.projectile',
  death: 'rts.death',
  renderable: 'rts.renderable',
} as const;

export interface PositionComponent {
  /** Tile-space, fractional. */
  col: number;
  row: number;
  /** Sampled altitude at the rounded tile. */
  altitude: number;
}

export interface VelocityComponent {
  vc: number;
  vr: number;
}

export interface FactionComponent {
  factionId: string;
}

export interface HealthComponent {
  hp: number;
  maxHp: number;
  armor: number;
}

export interface VisionComponent {
  sight: number;
}

export interface SelectableComponent {
  kind: 'unit' | 'building';
}

export interface UnitComponent {
  kind: UnitKind;
  speed: number;
  altitude: number;
}

export interface BuildingComponent {
  kind: BuildingKind;
  footprint: { cols: number; rows: number };
  origin: TilePos;
  /** 0..1 — `1` means fully constructed. */
  buildProgress: number;
  buildTimeMs: number;
}

export interface CombatComponent {
  range: number;
  damage: number;
  attackPeriodMs: number;
  cooldownMs: number;
  arc: 'direct' | 'parabolic';
  projectileKind: 'bullet' | 'rocket' | 'tracer';
  /** Current target entity id or null. */
  targetId: number | null;
}

export interface MovementComponent {
  /** Discrete tile path (fifo). */
  path: TilePos[];
  /** Final goal tile. */
  goal?: TilePos;
}

export interface WorkerComponent {
  state: 'idle' | 'movingToResource' | 'gathering' | 'returning';
  carryKind: ResourceKind | null;
  carryAmount: number;
  capacity: number;
  gatherCycleMs: number;
  cycleElapsedMs: number;
  resourceNodeId?: number;
  depotId?: number;
}

export interface ResourceNodeComponent {
  kind: ResourceKind;
  amount: number;
  origin: TilePos;
}

export interface ProductionQueueComponent {
  items: { kind: UnitKind | BuildingKind; isUnit: boolean; remainingMs: number; cost: ResourceCost; supply: number }[];
}

export interface ProjectileComponent {
  fromCol: number;
  fromRow: number;
  toEntity: number;
  damage: number;
  speed: number;
  arc: 'direct' | 'parabolic';
  kind: 'bullet' | 'rocket' | 'tracer';
  factionId: string;
  elapsedMs: number;
  totalMs: number;
}

export interface DeathComponent {
  /** Pending removal at end of step. */
  reason: 'killed' | 'destroyed' | 'consumed';
}

export interface RenderableComponent {
  /** Sprite key understood by the renderer. */
  kind: string;
  tint: number;
  /** Pixel size hint when no sprite is mounted. */
  width: number;
  height: number;
}
