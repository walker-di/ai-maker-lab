import {
  BUILDING_STATS,
  TECH_STATS,
  TUNABLES,
  UNIT_STATS,
  type BuildingKind,
  type Faction,
  type MapDefinition,
  type MatchDefinition,
  type ResourceCost,
  type ResolvedRtsMap,
  type TechKind,
  type TilePos,
  type UnitKind,
} from '../types.js';
import { COMPONENT_KINDS as C } from './components.js';
import type {
  BuildingComponent,
  CombatComponent,
  FactionComponent,
  HealthComponent,
  MovementComponent,
  PositionComponent,
  ProductionQueueComponent,
  RenderableComponent,
  ResearchQueueComponent,
  ResourceNodeComponent,
  SelectableComponent,
  UnitComponent,
  VisionComponent,
  WorkerComponent,
} from './components.js';
import { EngineEmitter, type EngineEventMap } from './events.js';
import {
  getAiWaveCadenceMs,
  missionDirectiveFromPhase,
  missionPressureDetailFromPhase,
  missionPressureFromScore,
  missionStatusFromPhase,
  missionToneFromPhaseAndPressure,
  missionWaveLabelAndDetail,
  type RtsMissionEnemyActivity,
  type RtsMissionPhase,
  type RtsMissionPressure,
  type RtsMissionState,
  type RtsMissionWaveStatus,
} from './mission.js';
import { FixedStepLoop } from './fixed-step-loop.js';
import { NullAudioBus, type AudioBus } from './audio-bus.js';
import { RtsFeedbackController, type RtsFeedbackSnapshot, type RtsOrderFeedbackKind } from './fx/feedback.js';
import { findPath } from './pathfinding.js';
import { TileGrid } from './tile-grid.js';
import {
  BuildProgressSystem,
  CombatSystem,
  FogOfWarSystem,
  HealthSystem,
  MovementSystem,
  ProductionSystem,
  ProjectileSystem,
  WorkerSystem,
  type FogOfWarSnapshot,
} from './systems.js';
import {
  ResearchSystem,
  createFactionTechState,
  type FactionTechState,
} from './systems/research.js';
import { EngineWorld, SystemEventBus, type System } from './world.js';

export interface RtsRendererSnapshot {
  cameraTile: { col: number; row: number };
  cameraZoom: number;
  entities: {
    id: number;
    col: number;
    row: number;
    altitude: number;
    width: number;
    height: number;
    tint: number;
    kind: string;
    factionId?: string;
    selected?: boolean;
    hpRatio?: number;
    buildProgress?: number;
  }[];
  fog?: FogOfWarSnapshot;
  fogFactionId?: string;
  feedback?: RtsFeedbackSnapshot;
}

export interface RtsRenderer {
  mount(container: HTMLDivElement | HTMLCanvasElement): Promise<void>;
  loadMap(map: MapDefinition): void;
  render(snapshot: RtsRendererSnapshot): void;
  dispose(): void;
  /**
   * Convert a `clientX` / `clientY` mouse coordinate into a tile position,
   * accounting for the canvas bounding rect, internal pixel ratio and the
   * current camera transform. Returns `null` when the renderer cannot map.
   */
  screenToTile?(clientX: number, clientY: number): TilePos | null;
  tileToScreen?(tile: TilePos, altitude?: number): RtsScreenPoint | null;
  /** Underlying canvas element (or null when not mounted). */
  getCanvas?(): HTMLCanvasElement | null;
  getViewportTileBounds?(): RtsViewportBounds | null;
  /** Optional renderer debug toggle between sprite and vector terrain/entity skin. */
  toggleSpriteMode?(): void;
  getSpriteMode?(): 'sprite' | 'vector';
}

export interface RtsEngineConfig {
  match: MatchDefinition;
  map: ResolvedRtsMap;
  fixedStepHz?: number;
  rendererFactory?: () => Promise<RtsRenderer>;
  /** When `true`, skip particles/screen-shake. */
  lowJuice?: boolean;
  audioBus?: AudioBus;
}

export interface RtsResourceState {
  mineral: number;
  gas: number;
  supplyUsed: number;
  supplyCap: number;
}

export interface RtsSelectionSummaryEntry {
  kind: string;
  category: 'unit' | 'building';
  count: number;
}

export interface RtsSelectionSummary {
  count: number;
  label: string;
  detail: string;
  averageHpRatio: number | null;
  composition: RtsSelectionSummaryEntry[];
}

export interface RtsProductionQueueEntry {
  producerId: number;
  producerKind: BuildingKind;
  kind: UnitKind | BuildingKind;
  isUnit: boolean;
  remainingMs: number;
  totalMs: number;
  progress: number;
}

export interface RtsMinimapBlip {
  id: number;
  col: number;
  row: number;
  category: 'unit' | 'building' | 'resource';
  relation: 'friendly' | 'enemy' | 'neutral';
  selected: boolean;
}

export interface RtsViewportBounds {
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
}

export interface RtsScreenPoint {
  x: number;
  y: number;
}

export interface RtsProductionOptionSummary {
  kind: UnitKind;
  selectedProducerCount: number;
  totalProducerCount: number;
  available: boolean;
}

export interface RtsSelectedRallyPoint {
  tile: TilePos;
  producerCount: number;
}

export interface RtsProductionStructureGroup {
  kind: BuildingKind;
  totalCount: number;
  selectedCount: number;
  readyCount: number;
  queueCount: number;
}

export interface RtsResearchQueueEntry {
  researcherId: number;
  researcherKind: BuildingKind;
  kind: TechKind;
  remainingMs: number;
  totalMs: number;
  progress: number;
}

export interface RtsResearchState {
  /** Techs that have been fully researched by this faction. */
  researched: TechKind[];
  /** Cumulative stat bonuses applied to all faction units. */
  totalArmorBonus: number;
  totalDamageBonus: number;
  totalSightBonus: number;
}

export interface RtsResearchOptionSummary {
  kind: TechKind;
  label: string;
  /** True if all prerequisite techs are already researched. */
  prerequisitesMet: boolean;
  /** True if already fully researched. */
  researched: boolean;
  /** True if currently queued in any researcher building. */
  queued: boolean;
  /** True if the player has at least one eligible researcher for this tech. */
  available: boolean;
  /** True if a ready researcher is free to start this tech right now. */
  queueReady: boolean;
  selectedResearcherCount: number;
  totalResearcherCount: number;
  busyResearcherCount: number;
  progress: number | null;
  blockedBy: TechKind[];
}

interface RtsMissionIntel {
  objectiveTitle: string;
  objectiveDetail: string;
  enemyFactionId: string | null;
  waveCadenceMs: number | null;
  nextWaveAtMs: number | null;
  lastWaveAtMs: number | null;
  lastWaveSize: number | null;
  wavesLaunched: number;
  lastLocalCombatAlertAtMs: number | null;
  lastCriticalAlertAtMs: number | null;
  result: 'victory' | 'defeat' | null;
}

/**
 * Main RTS engine surface. Wires the world, fixed-step loop, the canonical
 * systems, and selection/order processing for the local player. Designed to
 * be driven both headlessly (tests/AI) and via a Pixi renderer.
 */
export class RtsEngine {
  readonly emitter = new EngineEmitter();
  readonly world = new EngineWorld();
  readonly grid: TileGrid;
  readonly match: MatchDefinition;
  readonly map: ResolvedRtsMap;
  private readonly bus = new SystemEventBus();
  private readonly loop: FixedStepLoop;
  private readonly resources = new Map<string, { mineral: number; gas: number }>();
  private readonly supply = new Map<string, { used: number; cap: number }>();
  private readonly factionTech = new Map<string, FactionTechState>();
  private readonly factionIds: string[];
  private readonly factions: Map<string, Faction>;
  private renderer: RtsRenderer | null = null;
  private rendererFactory?: () => Promise<RtsRenderer>;
  private readonly fogSystem: FogOfWarSystem;
  private readonly feedback = new RtsFeedbackController();
  private readonly audioBus: AudioBus;
  private systems: System[] = [];
  private selection = new Set<number>();
  private cameraTile = { col: 0, row: 0 };
  private cameraZoom = 1;
  private running = false;
  private rafHandle: number | null = null;
  private elapsedMs = 0;
  private finished = false;
  private localFactionId: string;
  private mission: RtsMissionIntel;
  private lastMissionSignature = '';

  constructor(config: RtsEngineConfig) {
    this.match = config.match;
    this.map = config.map;
    this.grid = new TileGrid(config.map.definition);
    this.loop = new FixedStepLoop({ hz: config.fixedStepHz ?? 30 });
    this.factionIds = config.match.factions.map((f) => f.id);
    this.factions = new Map(config.match.factions.map((f) => [f.id, f]));
    this.fogSystem = new FogOfWarSystem(this.grid, this.factionIds);
    this.rendererFactory = config.rendererFactory;
    this.audioBus = config.audioBus ?? new NullAudioBus();
    this.localFactionId =
      config.match.factions.find((f) => f.isPlayer)?.id ?? config.match.factions[0]!.id;
    this.mission = this.createInitialMissionState();

    for (const faction of config.match.factions) {
      this.resources.set(faction.id, {
        mineral: config.match.rules.startingResources.mineral,
        gas: config.match.rules.startingResources.gas,
      });
      this.supply.set(faction.id, { used: 0, cap: config.match.rules.populationCap });
      this.factionTech.set(faction.id, createFactionTechState());
    }

    this.spawnMapEntities(config.map.definition);
    this.systems = this.buildSystems();
    const initialSpawn = config.map.definition.spawns.find((s) => s.factionId === this.localFactionId);
    if (initialSpawn) this.cameraTile = { ...initialSpawn.tile };
  }

  async mount(container: HTMLDivElement | HTMLCanvasElement): Promise<void> {
    if (this.rendererFactory) {
      this.renderer = await this.rendererFactory();
      await this.renderer.mount(container);
      this.renderer.loadMap(this.map.definition);
    }
  }

  dispose(): void {
    this.stop();
    this.renderer?.dispose();
    this.audioBus.dispose();
    this.renderer = null;
    this.emitter.removeAll();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    if (typeof window !== 'undefined') {
      let lastTime = performance.now();
      const frame = (now: number) => {
        if (!this.running) return;
        const dt = Math.min(0.1, (now - lastTime) / 1000);
        lastTime = now;
        this.tickReal(dt);
        this.rafHandle = window.requestAnimationFrame(frame);
      };
      this.rafHandle = window.requestAnimationFrame(frame);
    }
  }

  stop(): void {
    this.running = false;
    if (this.rafHandle != null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
  }

  tickReal(seconds: number): void {
    if (this.finished) return;
    this.feedback.step(seconds * 1000);
    if (!this.feedback.isHitStopped()) {
      this.loop.tick(seconds, () => this.runFixedStep());
    }
    this.render();
  }

  /** For headless tests: advance one fixed step. */
  tickFixed(): void {
    this.runFixedStep();
  }

  // ---------------------------------------------------------------------------
  // Public commands
  // ---------------------------------------------------------------------------

  screenToTile(clientX: number, clientY: number): TilePos | null {
    if (!this.renderer?.screenToTile) return null;
    return this.renderer.screenToTile(clientX, clientY);
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.renderer?.getCanvas?.() ?? null;
  }

  tileToScreen(tile: TilePos): RtsScreenPoint | null {
    if (!this.renderer?.tileToScreen) return null;
    return this.renderer.tileToScreen(tile, this.grid.getAltitude(tile.col, tile.row));
  }

  toggleSpriteMode(): 'sprite' | 'vector' {
    this.renderer?.toggleSpriteMode?.();
    return this.renderer?.getSpriteMode?.() ?? 'vector';
  }

  getSpriteMode(): 'sprite' | 'vector' {
    return this.renderer?.getSpriteMode?.() ?? 'vector';
  }

  /** Find the topmost entity whose tile matches `tile`, preferring units. */
  pickEntityAtTile(tile: TilePos): number | null {
    let buildingHit: number | null = null;
    for (const id of this.world.query([C.position, C.selectable])) {
      const pos = this.world.getComponent<PositionComponent>(id, C.position)!;
      if (this.world.hasComponent(id, C.unit)) {
        if (Math.floor(pos.col) === tile.col && Math.floor(pos.row) === tile.row) {
          return id;
        }
      } else if (this.world.hasComponent(id, C.building)) {
        const b = this.world.getComponent<BuildingComponent>(id, C.building)!;
        if (
          tile.col >= b.origin.col &&
          tile.col < b.origin.col + b.footprint.cols &&
          tile.row >= b.origin.row &&
          tile.row < b.origin.row + b.footprint.rows
        ) {
          buildingHit = id;
        }
      }
    }
    return buildingHit;
  }

  getCursorStateForTile(tile: TilePos): string {
    const entityId = this.pickEntityAtTile(tile);
    if (entityId == null) return this.selection.size > 0 ? 'move' : 'default';
    const faction = this.world.getComponent<FactionComponent>(entityId, C.faction);
    if (faction && faction.factionId !== this.localFactionId && this.selection.size > 0) return 'attack';
    const hp = this.world.getComponent<HealthComponent>(entityId, C.health);
    if (faction?.factionId === this.localFactionId && hp && hp.hp < hp.maxHp) return 'repair';
    return 'default';
  }

  /** Single-click selection. Targets enemy units/buildings as attack orders. */
  handleClickAtTile(tile: TilePos, additive = false): void {
    const entityId = this.pickEntityAtTile(tile);
    if (entityId != null) {
      const f = this.world.getComponent<FactionComponent>(entityId, C.faction);
      if (f && f.factionId === this.localFactionId) {
        if (!additive) this.selection.clear();
        this.selection.add(entityId);
        this.emitter.emit('selectionChanged', { entityIds: [...this.selection] });
        this.audioBus.playSfx('select');
        return;
      }
      // Enemy entity: if we have a selection, treat as attack order.
      if (this.selection.size > 0 && f && f.factionId !== this.localFactionId) {
        this.orderAttackTarget(entityId);
        return;
      }
    }
    // Empty tile click: clear selection if not additive.
    if (!additive) {
      this.selection.clear();
      this.emitter.emit('selectionChanged', { entityIds: [] });
    }
  }

  selectByIds(ids: number[]): void {
    this.selection = new Set(ids.filter((id) => this.world.isAlive(id)));
    this.emitter.emit('selectionChanged', { entityIds: [...this.selection] });
    if (this.selection.size > 0) this.audioBus.playSfx('select');
  }

  selectAtTile(tile: TilePos, additive = false): void {
    if (!additive) this.selection.clear();
    for (const id of this.world.query([C.position, C.selectable, C.faction])) {
      const pos = this.world.getComponent<PositionComponent>(id, C.position)!;
      const f = this.world.getComponent<FactionComponent>(id, C.faction)!;
      if (f.factionId !== this.localFactionId) continue;
      if (Math.floor(pos.col) === tile.col && Math.floor(pos.row) === tile.row) {
        this.selection.add(id);
      }
    }
    this.emitter.emit('selectionChanged', { entityIds: [...this.selection] });
    if (this.selection.size > 0) this.audioBus.playSfx('select');
  }

  selectInBox(a: TilePos, b: TilePos): void {
    const minCol = Math.min(a.col, b.col);
    const maxCol = Math.max(a.col, b.col);
    const minRow = Math.min(a.row, b.row);
    const maxRow = Math.max(a.row, b.row);
    this.selection.clear();
    for (const id of this.world.query([C.position, C.selectable, C.faction, C.unit])) {
      const pos = this.world.getComponent<PositionComponent>(id, C.position)!;
      const f = this.world.getComponent<FactionComponent>(id, C.faction)!;
      if (f.factionId !== this.localFactionId) continue;
      if (
        pos.col >= minCol && pos.col <= maxCol + 1 &&
        pos.row >= minRow && pos.row <= maxRow + 1
      ) {
        this.selection.add(id);
      }
    }
    this.emitter.emit('selectionChanged', { entityIds: [...this.selection] });
    if (this.selection.size > 0) this.audioBus.playSfx('select');
  }

  orderMoveSelectionTo(target: TilePos): void {
    for (const id of this.selection) {
      const pos = this.world.getComponent<PositionComponent>(id, C.position);
      const move = this.world.getComponent<MovementComponent>(id, C.movement);
      const combat = this.world.getComponent<CombatComponent>(id, C.combat);
      if (!pos || !move) continue;
      const worker = this.world.getComponent<WorkerComponent>(id, C.worker);
      const path = findPath(this.grid, { col: Math.floor(pos.col), row: Math.floor(pos.row) }, target);
      move.path = path?.slice(1) ?? [];
      move.goal = target;
      move.orderMode = 'move';
      move.patrol = undefined;
      move.holdTile = undefined;
      if (worker) {
        worker.autoGatherEnabled = false;
        worker.resourceNodeId = undefined;
      }
      if (combat) combat.targetId = null;
    }
    this.addOrderFeedback(target, 'move');
    this.audioBus.playSfx('move');
  }

  orderAttackTarget(targetId: number): void {
    let targetTile: TilePos | null = null;
    const targetPos = this.world.getComponent<PositionComponent>(targetId, C.position);
    if (targetPos) targetTile = { col: Math.floor(targetPos.col), row: Math.floor(targetPos.row) };
    for (const id of this.selection) {
      const combat = this.world.getComponent<CombatComponent>(id, C.combat);
      const move = this.world.getComponent<MovementComponent>(id, C.movement);
      const worker = this.world.getComponent<WorkerComponent>(id, C.worker);
      if (combat) combat.targetId = targetId;
      if (move) {
        move.path = [];
        move.goal = targetTile ?? move.goal;
        move.orderMode = 'move';
        move.patrol = undefined;
        move.holdTile = undefined;
      }
      if (worker) worker.autoGatherEnabled = false;
    }
    if (targetTile) this.addOrderFeedback(targetTile, 'attack');
    this.audioBus.playSfx('attack');
  }

  orderPatrolSelectionTo(target: TilePos): void {
    for (const id of this.selection) {
      const pos = this.world.getComponent<PositionComponent>(id, C.position);
      const move = this.world.getComponent<MovementComponent>(id, C.movement);
      if (!pos || !move) continue;
      const start = { col: Math.floor(pos.col), row: Math.floor(pos.row) };
      const worker = this.world.getComponent<WorkerComponent>(id, C.worker);
      const path = findPath(this.grid, start, target);
      move.path = path?.slice(1) ?? [];
      move.goal = target;
      move.orderMode = 'patrol';
      move.holdTile = undefined;
      move.patrol = { a: start, b: target, next: 'a' };
      if (worker) worker.autoGatherEnabled = false;
    }
    this.addOrderFeedback(target, 'patrol');
    this.audioBus.playSfx('move');
  }

  orderRepairTarget(targetId: number): void {
    const targetPos = this.world.getComponent<PositionComponent>(targetId, C.position);
    if (!targetPos) return;
    const targetTile = { col: Math.floor(targetPos.col), row: Math.floor(targetPos.row) };
    for (const id of this.selection) {
      const worker = this.world.getComponent<WorkerComponent>(id, C.worker);
      const pos = this.world.getComponent<PositionComponent>(id, C.position);
      const move = this.world.getComponent<MovementComponent>(id, C.movement);
      if (!worker || !pos || !move) continue;
      worker.repairTargetId = targetId;
      worker.state = 'movingToRepair';
      worker.autoGatherEnabled = false;
      const path = findPath(this.grid, { col: Math.floor(pos.col), row: Math.floor(pos.row) }, targetTile);
      move.path = path?.slice(1) ?? [];
      move.goal = targetTile;
      move.orderMode = 'move';
      move.holdTile = undefined;
    }
    this.addOrderFeedback(targetTile, 'repair');
    this.audioBus.playSfx('build-place');
  }

  orderAttackMoveSelectionTo(target: TilePos): void {
    for (const id of this.selection) {
      const pos = this.world.getComponent<PositionComponent>(id, C.position);
      const move = this.world.getComponent<MovementComponent>(id, C.movement);
      const combat = this.world.getComponent<CombatComponent>(id, C.combat);
      if (!pos || !move) continue;
      const worker = this.world.getComponent<WorkerComponent>(id, C.worker);
      const path = findPath(this.grid, { col: Math.floor(pos.col), row: Math.floor(pos.row) }, target);
      move.path = path?.slice(1) ?? [];
      move.goal = target;
      move.orderMode = 'attackMove';
      move.patrol = undefined;
      move.holdTile = undefined;
      if (worker) {
        worker.autoGatherEnabled = false;
        worker.resourceNodeId = undefined;
      }
      if (combat) combat.targetId = null;
    }
    this.addOrderFeedback(target, 'attack-move');
    this.audioBus.playSfx('attack-move');
  }

  issueContextOrderAtTile(tile: TilePos, mode: 'move' | 'attackMove' | 'patrol' | 'repair' = 'move'): void {
    if (mode === 'patrol') {
      this.orderPatrolSelectionTo(tile);
      return;
    }
    if (mode === 'attackMove') {
      this.orderAttackMoveSelectionTo(tile);
      return;
    }
    const targetEntity = this.pickEntityAtTile(tile);
    if (mode === 'repair' && targetEntity != null) {
      this.orderRepairTarget(targetEntity);
      return;
    }
    this.orderMoveSelectionTo(tile);
  }

  orderHarvest(nodeId: number): void {
    for (const id of this.selection) {
      const worker = this.world.getComponent<WorkerComponent>(id, C.worker);
      if (!worker) continue;
      worker.resourceNodeId = nodeId;
      worker.state = 'movingToResource';
      worker.autoGatherEnabled = true;
      const pos = this.world.getComponent<PositionComponent>(id, C.position)!;
      const move = this.world.getComponent<MovementComponent>(id, C.movement)!;
      const target = this.world.getComponent<PositionComponent>(nodeId, C.position);
      if (!target) continue;
      const tile = { col: Math.floor(target.col), row: Math.floor(target.row) };
      const path = findPath(this.grid, { col: Math.floor(pos.col), row: Math.floor(pos.row) }, tile);
      move.path = path?.slice(1) ?? [];
      move.goal = tile;
    }
    const targetPos = this.world.getComponent<PositionComponent>(nodeId, C.position);
    if (targetPos) this.addOrderFeedback({ col: Math.floor(targetPos.col), row: Math.floor(targetPos.row) }, 'repair');
  }

  enqueueProduction(producerId: number, kind: UnitKind): boolean {
    const queue = this.world.getComponent<ProductionQueueComponent>(producerId, C.productionQueue);
    const faction = this.world.getComponent<FactionComponent>(producerId, C.faction);
    const building = this.world.getComponent<BuildingComponent>(producerId, C.building);
    if (!queue || !faction || !building) return false;
    const buildingStats = BUILDING_STATS[building.kind];
    if (!buildingStats.canTrain?.includes(kind) || building.buildProgress < 1) return false;
    const stats = UNIT_STATS[kind];
    if (!this.spendIfAvailable(faction.factionId, stats.cost, stats.supply)) return false;
    queue.items.push({
      kind,
      isUnit: true,
      remainingMs: stats.buildTimeMs,
      cost: stats.cost,
      supply: stats.supply,
    });
    this.emitter.emit('productionStarted', { factionId: faction.factionId, kind });
    this.audioBus.playSfx('build-place');
    return true;
  }

  placeBuilding(factionId: string, kind: BuildingKind, atTile: TilePos): number | null {
    const stats = BUILDING_STATS[kind];
    if (kind === 'refinery' && !this.isAdjacentToGasNode(atTile, stats.footprint)) return null;
    if (!this.canPlaceBuilding(atTile, stats.footprint)) return null;
    if (!this.spendIfAvailable(factionId, stats.cost, 0)) return null;
    const entity = this.spawnBuilding(kind, factionId, atTile, false);
    this.addOrderFeedback(atTile, 'build-place');
    this.audioBus.playSfx('build-place');
    return entity;
  }

  enqueueProductionFromSelection(kind: UnitKind): number {
    const selectedEligible = [...this.selection].filter((id) => this.canProducerTrain(id, kind));
    if (selectedEligible.length > 0) {
      let queued = 0;
      for (const id of selectedEligible) {
        if (this.enqueueProduction(id, kind)) queued += 1;
      }
      return queued;
    }
    for (const id of this.world.query([C.productionQueue, C.faction, C.building])) {
      if (!this.canProducerTrain(id, kind)) continue;
      if (this.enqueueProduction(id, kind)) return 1;
    }
    return 0;
  }

  cancelLastProduction(producerId: number): { producerKind: BuildingKind; kind: UnitKind | BuildingKind; remainingQueueCount: number } | null {
    const queue = this.world.getComponent<ProductionQueueComponent>(producerId, C.productionQueue);
    const faction = this.world.getComponent<FactionComponent>(producerId, C.faction);
    const building = this.world.getComponent<BuildingComponent>(producerId, C.building);
    if (!queue || !faction || !building || faction.factionId !== this.localFactionId) return null;
    const canceled = queue.items.pop();
    if (!canceled) return null;
    this.refundResources(faction.factionId, canceled.cost);
    this.emitter.emit('productionCanceled', {
      factionId: faction.factionId,
      kind: canceled.kind,
      producerId,
    });
    return {
      producerKind: building.kind,
      kind: canceled.kind,
      remainingQueueCount: queue.items.length,
    };
  }

  /**
   * Queue a research item at `researcherId`. Returns `true` on success.
   * Fails if: the building doesn't support this tech, it's already researched,
   * prerequisites aren't met, the queue is occupied, or resources are
   * insufficient.
   */
  enqueueResearch(researcherId: number, kind: TechKind): boolean {
    const queue = this.world.getComponent<ResearchQueueComponent>(researcherId, C.researchQueue);
    const faction = this.world.getComponent<FactionComponent>(researcherId, C.faction);
    const building = this.world.getComponent<BuildingComponent>(researcherId, C.building);
    if (!queue || !faction || !building) return false;
    if (building.buildProgress < 1) return false;
    if (!BUILDING_STATS[building.kind].canResearch?.includes(kind)) return false;

    const tech = this.factionTech.get(faction.factionId);
    if (!tech) return false;
    if (tech.researched.has(kind)) return false;
    const stats = TECH_STATS[kind];
    for (const prereq of stats.requires) {
      if (!tech.researched.has(prereq)) return false;
    }
    if (this.getResearchQueue(faction.factionId).some((item) => item.kind === kind)) return false;
    if (queue.items.some((item) => item.kind === kind)) return false;
    if (queue.items.length > 0) return false;

    if (!this.spendIfAvailable(faction.factionId, stats.cost, 0)) return false;

    queue.items.push({
      kind,
      remainingMs: stats.researchTimeMs,
      totalMs: stats.researchTimeMs,
      cost: stats.cost,
    });
    this.emitter.emit('researchStarted', { factionId: faction.factionId, kind, researcherId });
    this.audioBus.playSfx('build-place');
    return true;
  }

  enqueueResearchFromSelection(kind: TechKind): number {
    const selectedEligible = [...this.selection].filter((id) => {
      const building = this.world.getComponent<BuildingComponent>(id, C.building);
      return building ? this.enqueueResearchCandidate(id, kind) : false;
    });
    if (selectedEligible.length > 0) return this.enqueueResearch(selectedEligible[0]!, kind) ? 1 : 0;

    for (const id of this.world.query([C.researchQueue, C.faction, C.building])) {
      if (!this.enqueueResearchCandidate(id, kind)) continue;
      if (this.enqueueResearch(id, kind)) return 1;
    }
    return 0;
  }

  /**
   * Cancel the active (first) research item at `researcherId`, refunding its
   * cost. Returns the canceled tech kind on success, or `null`.
   */
  cancelResearch(researcherId: number): TechKind | null {
    const queue = this.world.getComponent<ResearchQueueComponent>(researcherId, C.researchQueue);
    const faction = this.world.getComponent<FactionComponent>(researcherId, C.faction);
    if (!queue || !faction || faction.factionId !== this.localFactionId) return null;
    const canceled = queue.items.shift();
    if (!canceled) return null;
    this.refundResources(faction.factionId, canceled.cost);
    this.emitter.emit('researchCanceled', { factionId: faction.factionId, kind: canceled.kind, researcherId });
    return canceled.kind;
  }

  /** Returns the full research state for a faction (default: local player). */
  getResearchState(factionId = this.localFactionId): RtsResearchState {
    const tech = this.factionTech.get(factionId);
    if (!tech) return { researched: [], totalArmorBonus: 0, totalDamageBonus: 0, totalSightBonus: 0 };
    return {
      researched: [...tech.researched],
      totalArmorBonus: tech.totalArmorBonus,
      totalDamageBonus: tech.totalDamageBonus,
      totalSightBonus: tech.totalSightBonus,
    };
  }

  /** Returns in-progress research entries across all researcher buildings. */
  getResearchQueue(factionId = this.localFactionId): RtsResearchQueueEntry[] {
    const entries: RtsResearchQueueEntry[] = [];
    for (const id of this.world.query([C.researchQueue, C.faction, C.building])) {
      const faction = this.world.getComponent<FactionComponent>(id, C.faction);
      const building = this.world.getComponent<BuildingComponent>(id, C.building);
      const queue = this.world.getComponent<ResearchQueueComponent>(id, C.researchQueue);
      if (!faction || !building || !queue || faction.factionId !== factionId) continue;
      for (const item of queue.items) {
        entries.push({
          researcherId: id,
          researcherKind: building.kind,
          kind: item.kind,
          remainingMs: item.remainingMs,
          totalMs: item.totalMs,
          progress: 1 - item.remainingMs / Math.max(1, item.totalMs),
        });
      }
    }
    return entries.sort((a, b) => a.remainingMs - b.remainingMs);
  }

  /**
   * Returns a summary of every tech option for the local player, including
   * which are researched, queued, or available to queue.
   */
  getResearchOptions(factionId = this.localFactionId): RtsResearchOptionSummary[] {
    const tech = this.factionTech.get(factionId);
    const selectedIds = new Set(this.selection);
    const queuedKinds = new Map<TechKind, RtsResearchQueueEntry>();
    const counts = new Map<TechKind, {
      selectedResearcherCount: number;
      totalResearcherCount: number;
      busyResearcherCount: number;
    }>();

    for (const kind of Object.keys(TECH_STATS) as TechKind[]) {
      counts.set(kind, {
        selectedResearcherCount: 0,
        totalResearcherCount: 0,
        busyResearcherCount: 0,
      });
    }

    for (const id of this.world.query([C.researchQueue, C.faction, C.building])) {
      const faction = this.world.getComponent<FactionComponent>(id, C.faction);
      const building = this.world.getComponent<BuildingComponent>(id, C.building);
      const queue = this.world.getComponent<ResearchQueueComponent>(id, C.researchQueue);
      if (!faction || !building || !queue || faction.factionId !== factionId) continue;
      if (building.buildProgress < 1) continue;
      for (const kind of BUILDING_STATS[building.kind].canResearch ?? []) {
        const current = counts.get(kind);
        if (!current) continue;
        current.totalResearcherCount += 1;
        if (selectedIds.has(id)) current.selectedResearcherCount += 1;
        if (queue.items.length > 0) current.busyResearcherCount += 1;
      }
      for (const item of queue.items) {
        queuedKinds.set(item.kind, {
          researcherId: id,
          researcherKind: building.kind,
          kind: item.kind,
          remainingMs: item.remainingMs,
          totalMs: item.totalMs,
          progress: 1 - item.remainingMs / Math.max(1, item.totalMs),
        });
      }
    }

    return (Object.keys(TECH_STATS) as TechKind[]).map((kind) => {
      const stats = TECH_STATS[kind];
      const researched = tech?.researched.has(kind) ?? false;
      const blockedBy = stats.requires.filter((required) => !(tech?.researched.has(required) ?? false));
      const current = counts.get(kind) ?? {
        selectedResearcherCount: 0,
        totalResearcherCount: 0,
        busyResearcherCount: 0,
      };
      const queued = queuedKinds.get(kind);
      const prerequisitesMet = blockedBy.length === 0;
      const available = current.totalResearcherCount > 0;
      const queueReady = available && prerequisitesMet && !researched && !queued && current.busyResearcherCount < current.totalResearcherCount;
      return {
        kind,
        label: stats.label,
        prerequisitesMet,
        researched,
        queued: Boolean(queued),
        available,
        queueReady,
        selectedResearcherCount: current.selectedResearcherCount,
        totalResearcherCount: current.totalResearcherCount,
        busyResearcherCount: current.busyResearcherCount,
        progress: queued?.progress ?? null,
        blockedBy,
      };
    });
  }

  /**
   * Returns `true` if `kind` can currently be queued by `factionId`:
   * not already researched, prerequisites met, at least one ready researcher
   * exists, that researcher's queue is free, and resources are sufficient.
   */
  canResearch(kind: TechKind, factionId = this.localFactionId): boolean {
    const tech = this.factionTech.get(factionId);
    if (!tech || tech.researched.has(kind)) return false;
    const stats = TECH_STATS[kind];
    for (const prereq of stats.requires) {
      if (!tech.researched.has(prereq)) return false;
    }
    if (this.getResearchQueue(factionId).some((item) => item.kind === kind)) return false;
    const res = this.resources.get(factionId);
    if (!res || res.mineral < stats.cost.mineral || res.gas < stats.cost.gas) return false;
    for (const id of this.world.query([C.researchQueue, C.faction, C.building])) {
      const faction = this.world.getComponent<FactionComponent>(id, C.faction);
      const building = this.world.getComponent<BuildingComponent>(id, C.building);
      const queue = this.world.getComponent<ResearchQueueComponent>(id, C.researchQueue);
      if (!faction || !building || !queue || faction.factionId !== factionId) continue;
      if (building.buildProgress < 1) continue;
      if (!BUILDING_STATS[building.kind].canResearch?.includes(kind)) continue;
      if (queue.items.length === 0) return true;
    }
    return false;
  }

  setSelectedRallyPoint(target: TilePos): number {
    const safeTarget = {
      col: Math.max(0, Math.min(this.grid.cols - 1, target.col)),
      row: Math.max(0, Math.min(this.grid.rows - 1, target.row)),
    };
    let updated = 0;
    for (const id of this.selection) {
      if (!this.isReadyProductionBuilding(id)) continue;
      const building = this.world.getComponent<BuildingComponent>(id, C.building);
      if (!building) continue;
      building.rallyPoint = { ...safeTarget };
      updated += 1;
    }
    if (updated > 0) {
      this.addOrderFeedback(safeTarget, 'move');
      this.audioBus.playSfx('move');
    }
    return updated;
  }

  registerEnemyWaveCadence(factionId: string, cadenceMs: number): void {
    if (factionId === this.localFactionId) return;
    if (this.mission.enemyFactionId == null) this.mission.enemyFactionId = factionId;
    this.mission.waveCadenceMs = cadenceMs;
    this.emitMissionUpdatedIfChanged();
  }

  reportSquadLaunched(payload: {
    factionId: string;
    size: number;
    waveIndex: number;
    launchedAtMs?: number;
    cadenceMs?: number;
    targetTile?: TilePos;
  }): void {
    const launchedAtMs = payload.launchedAtMs ?? this.elapsedMs;
    if (payload.factionId !== this.localFactionId) {
      if (this.mission.enemyFactionId == null) this.mission.enemyFactionId = payload.factionId;
      if (payload.cadenceMs != null) this.mission.waveCadenceMs = payload.cadenceMs;
      this.mission.lastWaveAtMs = launchedAtMs;
      this.mission.lastWaveSize = payload.size;
      this.mission.wavesLaunched = Math.max(this.mission.wavesLaunched, payload.waveIndex);
      this.mission.nextWaveAtMs = payload.cadenceMs != null ? launchedAtMs + payload.cadenceMs : this.mission.nextWaveAtMs;
    }
    this.emitter.emit('squadLaunched', { ...payload, launchedAtMs });
    this.emitMissionUpdatedIfChanged();
  }

  // ---------------------------------------------------------------------------
  // Read-only state
  // ---------------------------------------------------------------------------

  getSelection(): number[] { return [...this.selection]; }
  getEntityTile(entityId: number): TilePos | null {
    const pos = this.world.getComponent<PositionComponent>(entityId, C.position);
    if (!pos) return null;
    return { col: Math.floor(pos.col), row: Math.floor(pos.row) };
  }
  getSelectionSummary(): RtsSelectionSummary {
    const ids = [...this.selection].filter((id) => this.world.isAlive(id));
    if (ids.length === 0) {
      return {
        count: 0,
        label: 'No selection',
        detail: 'Click or drag-select units to issue commands.',
        averageHpRatio: null,
        composition: [],
      };
    }

    const composition = new Map<string, RtsSelectionSummaryEntry>();
    let hpRatioSum = 0;
    let hpRatioCount = 0;

    for (const id of ids) {
      const unit = this.world.getComponent<UnitComponent>(id, C.unit);
      const building = this.world.getComponent<BuildingComponent>(id, C.building);
      const health = this.world.getComponent<HealthComponent>(id, C.health);
      const key = unit?.kind ?? building?.kind ?? 'entity';
      const category: 'unit' | 'building' = unit ? 'unit' : 'building';
      const current = composition.get(key);
      if (current) current.count += 1;
      else composition.set(key, { kind: key, category, count: 1 });
      if (health) {
        hpRatioSum += health.hp / Math.max(1, health.maxHp);
        hpRatioCount += 1;
      }
    }

    const entries = [...composition.values()].sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind));
    const averageHpRatio = hpRatioCount > 0 ? hpRatioSum / hpRatioCount : null;

    if (ids.length === 1) {
      const [entry] = entries;
      return {
        count: 1,
        label: titleCase(entry?.kind ?? 'Entity'),
        detail: `${entry?.category === 'building' ? 'Structure' : 'Unit'}${averageHpRatio != null ? ` · ${Math.round(averageHpRatio * 100)}% HP` : ''}`,
        averageHpRatio,
        composition: entries,
      };
    }

    return {
      count: ids.length,
      label: `${ids.length} selected`,
      detail: entries.map((entry) => `${entry.count} ${titleCase(entry.kind)}${entry.count > 1 ? 's' : ''}`).join(' · '),
      averageHpRatio,
      composition: entries,
    };
  }
  getSelectedRallyPoint(): RtsSelectedRallyPoint | null {
    let producerCount = 0;
    let sumCol = 0;
    let sumRow = 0;
    for (const id of this.selection) {
      if (!this.isReadyProductionBuilding(id)) continue;
      const building = this.world.getComponent<BuildingComponent>(id, C.building);
      if (!building?.rallyPoint) continue;
      producerCount += 1;
      sumCol += building.rallyPoint.col;
      sumRow += building.rallyPoint.row;
    }
    if (producerCount === 0) return null;
    return {
      tile: {
        col: Math.round(sumCol / producerCount),
        row: Math.round(sumRow / producerCount),
      },
      producerCount,
    };
  }
  getProductionStructureGroups(factionId = this.localFactionId): RtsProductionStructureGroup[] {
    const selectedIds = new Set(this.selection);
    const groups = new Map<BuildingKind, RtsProductionStructureGroup>();
    for (const id of this.world.query([C.productionQueue, C.faction, C.building])) {
      const faction = this.world.getComponent<FactionComponent>(id, C.faction);
      const building = this.world.getComponent<BuildingComponent>(id, C.building);
      const queue = this.world.getComponent<ProductionQueueComponent>(id, C.productionQueue);
      if (!faction || !building || !queue || faction.factionId !== factionId) continue;
      const current = groups.get(building.kind) ?? {
        kind: building.kind,
        totalCount: 0,
        selectedCount: 0,
        readyCount: 0,
        queueCount: 0,
      };
      current.totalCount += 1;
      if (selectedIds.has(id)) current.selectedCount += 1;
      if (building.buildProgress >= 1) current.readyCount += 1;
      current.queueCount += queue.items.length;
      groups.set(building.kind, current);
    }
    const order: BuildingKind[] = ['hq', 'barracks', 'factory'];
    return order
      .map((kind) => groups.get(kind))
      .filter((group): group is RtsProductionStructureGroup => Boolean(group));
  }
  getProductionOptions(factionId = this.localFactionId): RtsProductionOptionSummary[] {
    const selectedIds = new Set(this.selection);
    const counts = new Map<UnitKind, { selectedProducerCount: number; totalProducerCount: number }>();
    for (const kind of Object.keys(UNIT_STATS) as UnitKind[]) {
      counts.set(kind, { selectedProducerCount: 0, totalProducerCount: 0 });
    }
    for (const id of this.world.query([C.productionQueue, C.faction, C.building])) {
      const faction = this.world.getComponent<FactionComponent>(id, C.faction);
      const building = this.world.getComponent<BuildingComponent>(id, C.building);
      if (!faction || !building || faction.factionId !== factionId || building.buildProgress < 1) continue;
      const canTrain = BUILDING_STATS[building.kind].canTrain ?? [];
      for (const kind of canTrain) {
        const current = counts.get(kind);
        if (!current) continue;
        current.totalProducerCount += 1;
        if (selectedIds.has(id)) current.selectedProducerCount += 1;
      }
    }
    return (Object.keys(UNIT_STATS) as UnitKind[]).map((kind) => {
      const current = counts.get(kind) ?? { selectedProducerCount: 0, totalProducerCount: 0 };
      return {
        kind,
        selectedProducerCount: current.selectedProducerCount,
        totalProducerCount: current.totalProducerCount,
        available: current.totalProducerCount > 0,
      };
    });
  }
  getProductionQueue(factionId = this.localFactionId): RtsProductionQueueEntry[] {
    const entries: RtsProductionQueueEntry[] = [];
    for (const id of this.world.query([C.productionQueue, C.faction, C.building])) {
      const faction = this.world.getComponent<FactionComponent>(id, C.faction);
      const building = this.world.getComponent<BuildingComponent>(id, C.building);
      const queue = this.world.getComponent<ProductionQueueComponent>(id, C.productionQueue);
      if (!faction || !building || !queue || faction.factionId !== factionId) continue;
      for (const item of queue.items) {
        const totalMs = item.isUnit
          ? UNIT_STATS[item.kind as UnitKind].buildTimeMs
          : BUILDING_STATS[item.kind as BuildingKind].buildTimeMs;
        entries.push({
          producerId: id,
          producerKind: building.kind,
          kind: item.kind,
          isUnit: item.isUnit,
          remainingMs: item.remainingMs,
          totalMs,
          progress: 1 - item.remainingMs / Math.max(1, totalMs),
        });
      }
    }
    return entries.sort((a, b) => a.remainingMs - b.remainingMs);
  }
  getResources(factionId: string): RtsResourceState {
    const totals = this.resources.get(factionId) ?? { mineral: 0, gas: 0 };
    const supply = this.supply.get(factionId) ?? { used: 0, cap: TUNABLES.defaultPopulationCap };
    return { ...totals, supplyUsed: supply.used, supplyCap: supply.cap };
  }
  getMissionState(): RtsMissionState {
    const elapsedMs = this.elapsedMs;
    const cadenceMs = this.mission.waveCadenceMs;
    const countdownMs = this.mission.nextWaveAtMs == null ? null : Math.max(0, this.mission.nextWaveAtMs - elapsedMs);
    const activeCombatUnits = this.countActiveEnemyCombatUnits(this.mission.enemyFactionId);
    const pressureScore = this.computeMissionPressureScore(elapsedMs, countdownMs, activeCombatUnits);
    const pressure = missionPressureFromScore(pressureScore);
    const phase = this.computeMissionPhase(elapsedMs, pressure, activeCombatUnits);
    const enemyActivity = this.buildMissionEnemyActivity(elapsedMs, cadenceMs, countdownMs, activeCombatUnits, phase);

    const waveAgeMs = enemyActivity.lastWaveAtMs == null
      ? null
      : Math.max(0, elapsedMs - enemyActivity.lastWaveAtMs);

    const pressureDetail = missionPressureDetailFromPhase(
      pressure,
      phase,
      enemyActivity.wavesLaunched,
      enemyActivity.wavesLaunched,
      enemyActivity.lastWaveSize,
      waveAgeMs,
    );

    const { waveLabel, waveDetail } = missionWaveLabelAndDetail(
      phase,
      enemyActivity.wavesLaunched,
      enemyActivity.lastWaveSize,
      waveAgeMs,
    );

    return {
      status: missionStatusFromPhase(phase),
      tone: missionToneFromPhaseAndPressure(phase, pressure),
      phase,
      pressure,
      objectiveTitle: this.mission.objectiveTitle,
      objectiveDetail: this.resolveMissionObjectiveDetail(phase),
      directive: missionDirectiveFromPhase(phase),
      pressureLabel: this.describeMissionPressure(pressure, enemyActivity),
      pressureDetail,
      waveLabel,
      waveDetail,
      elapsedMs,
      enemyActivity,
    };
  }
  getLocalFactionId(): string { return this.localFactionId; }
  getFog(factionId: string): FogOfWarSnapshot | undefined {
    return this.fogSystem.snapshots.get(factionId);
  }
  getElapsedMs(): number { return this.elapsedMs; }
  getCameraTile(): TilePos { return { ...this.cameraTile }; }
  getCameraZoom(): number { return this.cameraZoom; }
  getSelectionAnchorTile(): TilePos | null {
    const ids = [...this.selection].filter((id) => this.world.isAlive(id));
    if (ids.length === 0) return null;
    let sumCol = 0;
    let sumRow = 0;
    let count = 0;
    for (const id of ids) {
      const pos = this.world.getComponent<PositionComponent>(id, C.position);
      if (!pos) continue;
      sumCol += Math.floor(pos.col);
      sumRow += Math.floor(pos.row);
      count += 1;
    }
    if (count === 0) return null;
    return {
      col: Math.round(sumCol / count),
      row: Math.round(sumRow / count),
    };
  }
  getViewportBounds(): RtsViewportBounds {
    const bounds = this.renderer?.getViewportTileBounds?.();
    if (bounds) return bounds;
    const halfCols = 8;
    const halfRows = 6;
    return {
      minCol: Math.max(0, this.cameraTile.col - halfCols),
      maxCol: Math.min(this.grid.cols - 1, this.cameraTile.col + halfCols),
      minRow: Math.max(0, this.cameraTile.row - halfRows),
      maxRow: Math.min(this.grid.rows - 1, this.cameraTile.row + halfRows),
    };
  }
  setCameraTile(tile: TilePos): void { this.cameraTile = { ...tile }; }
  getMinimapBlips(factionId = this.localFactionId): RtsMinimapBlip[] {
    const fog = this.fogSystem.snapshots.get(factionId);
    const blips: RtsMinimapBlip[] = [];
    for (const id of this.world.query([C.position, C.renderable])) {
      const pos = this.world.getComponent<PositionComponent>(id, C.position)!;
      const renderable = this.world.getComponent<RenderableComponent>(id, C.renderable)!;
      if (renderable.kind.startsWith('projectile-')) continue;
      const col = Math.max(0, Math.min(this.grid.cols - 1, Math.floor(pos.col)));
      const row = Math.max(0, Math.min(this.grid.rows - 1, Math.floor(pos.row)));
      if (fog && fog.cells[row * fog.cols + col] === 0) continue;
      const faction = this.world.getComponent<FactionComponent>(id, C.faction);
      const relation: RtsMinimapBlip['relation'] = !faction
        ? 'neutral'
        : faction.factionId === factionId
          ? 'friendly'
          : 'enemy';
      const category: RtsMinimapBlip['category'] = renderable.kind.startsWith('building-')
        ? 'building'
        : renderable.kind.endsWith('-node')
          ? 'resource'
          : 'unit';
      blips.push({
        id,
        col,
        row,
        category,
        relation,
        selected: this.selection.has(id),
      });
    }
    return blips;
  }
  selectArmy(): void {
    const nonWorkerIds: number[] = [];
    const fallbackIds: number[] = [];
    for (const id of this.world.query([C.unit, C.faction, C.selectable])) {
      const faction = this.world.getComponent<FactionComponent>(id, C.faction);
      const unit = this.world.getComponent<UnitComponent>(id, C.unit);
      if (!faction || !unit || faction.factionId !== this.localFactionId) continue;
      fallbackIds.push(id);
      if (unit.kind !== 'worker') nonWorkerIds.push(id);
    }
    this.selectByIds(nonWorkerIds.length > 0 ? nonWorkerIds : fallbackIds);
  }
  selectProductionBuildings(kind: BuildingKind): number {
    const ids = [...this.world.query([C.productionQueue, C.faction, C.building])].filter((id) => {
      const faction = this.world.getComponent<FactionComponent>(id, C.faction);
      const building = this.world.getComponent<BuildingComponent>(id, C.building);
      return faction?.factionId === this.localFactionId && building?.kind === kind;
    });
    this.selectByIds(ids);
    return ids.length;
  }
  stopSelection(): void {
    for (const id of this.selection) {
      const move = this.world.getComponent<MovementComponent>(id, C.movement);
      const combat = this.world.getComponent<CombatComponent>(id, C.combat);
      const worker = this.world.getComponent<WorkerComponent>(id, C.worker);
      const pos = this.world.getComponent<PositionComponent>(id, C.position);
      if (move) {
        move.path = [];
        move.goal = undefined;
        move.patrol = undefined;
        move.orderMode = 'idle';
        move.holdTile = pos ? { col: Math.floor(pos.col), row: Math.floor(pos.row) } : undefined;
      }
      if (combat) combat.targetId = null;
      if (worker) {
        worker.state = 'idle';
        worker.autoGatherEnabled = false;
        worker.resourceNodeId = undefined;
        worker.depotId = undefined;
        worker.repairTargetId = undefined;
      }
    }
  }
  holdSelection(): void {
    for (const id of this.selection) {
      const move = this.world.getComponent<MovementComponent>(id, C.movement);
      const combat = this.world.getComponent<CombatComponent>(id, C.combat);
      const pos = this.world.getComponent<PositionComponent>(id, C.position);
      const worker = this.world.getComponent<WorkerComponent>(id, C.worker);
      if (move) {
        move.path = [];
        move.patrol = undefined;
        move.goal = pos ? { col: Math.floor(pos.col), row: Math.floor(pos.row) } : move.goal;
        move.orderMode = 'hold';
        move.holdTile = pos ? { col: Math.floor(pos.col), row: Math.floor(pos.row) } : move.holdTile;
      }
      if (combat) combat.targetId = null;
      if (worker) {
        worker.state = 'idle';
        worker.autoGatherEnabled = false;
        worker.repairTargetId = undefined;
      }
    }
  }
  panCamera(dCol: number, dRow: number): void {
    this.cameraTile.col = Math.max(0, Math.min(this.grid.cols - 1, this.cameraTile.col + dCol));
    this.cameraTile.row = Math.max(0, Math.min(this.grid.rows - 1, this.cameraTile.row + dRow));
  }
  zoomBy(factor: number): void {
    this.cameraZoom = Math.max(0.5, Math.min(2.5, this.cameraZoom * factor));
  }
  setAudioMuted(muted: boolean): void { this.audioBus.setMuted?.(muted); }
  async resumeAudio(): Promise<void> { await this.audioBus.resume?.(); }

  isFinished(): boolean { return this.finished; }

  private createInitialMissionState(): RtsMissionIntel {
    const enemyFaction = this.match.factions.find((f) => f.id !== this.localFactionId && (f.isAi || !f.isPlayer));
    return {
      objectiveTitle: 'Hold the line',
      objectiveDetail: 'Protect your HQ, absorb enemy attack waves, and destroy the hostile base.',
      enemyFactionId: enemyFaction?.id ?? null,
      waveCadenceMs: enemyFaction?.aiDifficulty ? getAiWaveCadenceMs(enemyFaction.aiDifficulty) : null,
      nextWaveAtMs: null,
      lastWaveAtMs: null,
      lastWaveSize: null,
      wavesLaunched: 0,
      lastLocalCombatAlertAtMs: null,
      lastCriticalAlertAtMs: null,
      result: null,
    };
  }

  private countActiveEnemyCombatUnits(enemyFactionId: string | null): number {
    if (!enemyFactionId) return 0;
    let total = 0;
    for (const id of this.world.query([C.unit, C.faction, C.combat])) {
      const faction = this.world.getComponent<FactionComponent>(id, C.faction);
      const unit = this.world.getComponent<UnitComponent>(id, C.unit);
      if (!faction || !unit || faction.factionId !== enemyFactionId || unit.kind === 'worker') continue;
      total += 1;
    }
    return total;
  }

  private computeMissionPressureScore(elapsedMs: number, countdownMs: number | null, activeCombatUnits: number): number {
    let score = 0;
    if (activeCombatUnits >= 2) score += Math.min(0.28, activeCombatUnits * 0.06);
    if (this.mission.wavesLaunched > 0) score += 0.12;
    if (countdownMs != null) {
      if (countdownMs <= 0) score += 0.18;
      else if (countdownMs <= 10_000) score += 0.14;
      else if (countdownMs <= 20_000) score += 0.08;
    }
    if (this.mission.lastWaveAtMs != null && elapsedMs - this.mission.lastWaveAtMs <= 12_000) score += 0.2;
    if (this.mission.lastLocalCombatAlertAtMs != null && elapsedMs - this.mission.lastLocalCombatAlertAtMs <= 8_000) score += 0.28;
    if (this.mission.lastCriticalAlertAtMs != null && elapsedMs - this.mission.lastCriticalAlertAtMs <= 8_000) score += 0.32;
    return Math.max(0, Math.min(1, score));
  }

  private computeMissionPhase(
    elapsedMs: number,
    pressure: RtsMissionPressure,
    activeCombatUnits: number,
  ): RtsMissionPhase {
    if (this.mission.result === 'victory') return 'victory';
    if (this.mission.result === 'defeat') return 'defeat';
    if (pressure === 'critical' || pressure === 'high' || this.mission.wavesLaunched > 0) return 'defense';
    if (elapsedMs >= 45_000 || activeCombatUnits >= 2) return 'build-up';
    return 'opening';
  }

  private buildMissionEnemyActivity(
    elapsedMs: number,
    cadenceMs: number | null,
    countdownMs: number | null,
    activeCombatUnits: number,
    phase: RtsMissionPhase,
  ): RtsMissionEnemyActivity {
    const status = this.resolveMissionWaveStatus(elapsedMs, countdownMs, phase);
    return {
      factionId: this.mission.enemyFactionId,
      activeCombatUnits,
      wavesLaunched: this.mission.wavesLaunched,
      lastWaveSize: this.mission.lastWaveSize,
      lastWaveAtMs: this.mission.lastWaveAtMs,
      cadenceMs,
      countdownMs,
      status,
      statusLabel: this.describeMissionWave(status, countdownMs),
    };
  }

  private resolveMissionWaveStatus(
    elapsedMs: number,
    countdownMs: number | null,
    phase: RtsMissionPhase,
  ): RtsMissionWaveStatus {
    if (phase === 'victory' || phase === 'defeat') return 'resolved';
    if (this.mission.lastWaveAtMs != null && elapsedMs - this.mission.lastWaveAtMs <= 12_000) return 'inbound';
    if (countdownMs == null) return 'forming';
    if (countdownMs <= 10_000) return 'imminent';
    return 'cooldown';
  }

  private resolveMissionObjectiveDetail(phase: RtsMissionPhase): string {
    if (phase === 'victory') return 'Enemy command destroyed. Consolidate the field and prepare to redeploy.';
    if (phase === 'defeat') return 'Your defenses collapsed before the final wave could be contained.';
    return this.mission.objectiveDetail;
  }

  private describeMissionPressure(
    pressure: RtsMissionPressure,
    enemyActivity: RtsMissionEnemyActivity,
  ): string {
    if (pressure === 'critical') return 'Base under heavy fire';
    if (pressure === 'high') return enemyActivity.status === 'imminent' ? 'Wave contact imminent' : 'Frontline under pressure';
    if (pressure === 'rising') return enemyActivity.status === 'forming' ? 'Enemy forces massing' : 'Hostile movement detected';
    return 'Perimeter stable';
  }

  private describeMissionWave(status: RtsMissionWaveStatus, countdownMs: number | null): string {
    if (status === 'resolved') return this.mission.result === 'victory' ? 'Threat neutralized' : 'Defense broken';
    if (status === 'inbound') return `Wave ${Math.max(1, this.mission.wavesLaunched)} is in contact`;
    if (status === 'imminent') return countdownMs == null ? 'Wave imminent' : `Next wave in ${formatMissionClock(countdownMs)}`;
    if (status === 'cooldown') return countdownMs == null ? 'Enemy regrouping' : `Next wave in ${formatMissionClock(countdownMs)}`;
    return this.mission.waveCadenceMs != null ? 'Enemy wave building' : 'Enemy activity unknown';
  }

  private noteCombatAlert(payload: EngineEventMap['combatAlert']): void {
    if (payload.factionId !== this.localFactionId) return;
    this.mission.lastLocalCombatAlertAtMs = this.elapsedMs;
    if (payload.kind === 'critical' || payload.severity === 'danger') {
      this.mission.lastCriticalAlertAtMs = this.elapsedMs;
    }
    this.emitMissionUpdatedIfChanged();
  }

  private emitMissionUpdatedIfChanged(force = false): void {
    const state = this.getMissionState();
    const signature = [
      state.status,
      state.tone,
      state.phase,
      state.pressure,
      state.enemyActivity.status,
      state.enemyActivity.wavesLaunched,
      state.enemyActivity.lastWaveSize ?? '-',
      state.enemyActivity.activeCombatUnits,
      state.enemyActivity.countdownMs == null ? '-' : Math.ceil(state.enemyActivity.countdownMs / 1000),
    ].join('|');
    if (!force && signature === this.lastMissionSignature) return;
    this.lastMissionSignature = signature;
    this.emitter.emit('missionUpdated', { state });
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private buildSystems(): System[] {
    return [
      new BuildProgressSystem(),
      new MovementSystem(this.grid),
      new CombatSystem(this.grid, (from, toEntity, damage, kind, arc, factionId) =>
        this.spawnProjectile(from, toEntity, damage, kind, arc, factionId),
      ),
      new ProjectileSystem(),
      new WorkerSystem(this.grid, this.resources),
      new ProductionSystem(this.resources, (kind, factionId, atTile, producerId) => {
        const entity = this.spawnUnit(kind, factionId, atTile);
        this.applyProducerRallyPoint(producerId, entity);
        return entity;
      }),
      new ResearchSystem(this.factionTech),
      new HealthSystem(),
      this.fogSystem,
    ];
  }

  private runFixedStep(): void {
    const dt = this.loop.stepDt;
    const ctx = { bus: this.bus, stepIndex: this.loop.totalSteps(), totalStepsMs: this.elapsedMs };
    for (const system of this.systems) system.update(this.world, dt, ctx);
    this.processEvents();
    this.elapsedMs += dt * 1000;
    this.checkVictory();
    this.emitMissionUpdatedIfChanged();
  }

  private processEvents(): void {
    for (const evt of this.bus.drain()) {
      switch (evt.type) {
        case 'death': {
          if (typeof evt.entity === 'number') {
            const isBuilding = evt.isBuilding === true;
            const factionId = typeof evt.factionId === 'string' ? evt.factionId : 'unknown';
            this.emitter.emit('unitKilled', {
              entity: evt.entity,
              factionId,
            });
            this.audioBus.playSfx(isBuilding ? 'rocket-hit' : 'unit-die');
            this.feedback.addCombatHeat(0.35);
            if (evt.tile && typeof evt.tile === 'object') {
              this.feedback.addImpactFlash(evt.tile as TilePos, isBuilding ? 'critical' : 'tracer');
              const alert = {
                tile: evt.tile as TilePos,
                factionId,
                kind: 'critical' as const,
                severity: isBuilding || factionId === this.localFactionId ? 'danger' as const : 'warning' as const,
              };
              this.emitter.emit('combatAlert', alert);
              this.noteCombatAlert(alert);
            }
            if (isBuilding) this.feedback.triggerHitStop(110);
            this.recountSupply();
          }
          break;
        }
        case 'productionCompleted':
          if (typeof evt.factionId === 'string' && typeof evt.kind === 'string') {
            this.emitter.emit('productionCompleted', {
              factionId: evt.factionId,
              kind: evt.kind,
              entity: typeof evt.entity === 'number' ? evt.entity : undefined,
            });
            this.audioBus.playSfx('build-complete');
            this.recountSupply();
          }
          break;
        case 'buildingCompleted':
          if (typeof evt.entity === 'number' && typeof evt.factionId === 'string' && typeof evt.kind === 'string') {
            this.emitter.emit('buildingPlaced', { entity: evt.entity, factionId: evt.factionId, kind: evt.kind });
            this.audioBus.playSfx('build-complete');
            this.recomputeSupplyCapForFaction(evt.factionId);
          }
          break;
        case 'researchCompleted':
          if (typeof evt.factionId === 'string' && typeof evt.kind === 'string') {
            this.emitter.emit('researchCompleted', {
              factionId: evt.factionId,
              kind: evt.kind as TechKind,
            });
            this.audioBus.playSfx('build-complete');
          }
          break;
        case 'resourceChanged':
          if (typeof evt.factionId === 'string') {
            this.emitter.emit('resourceChanged', {
              factionId: evt.factionId,
              mineral: typeof evt.mineral === 'number' ? evt.mineral : 0,
              gas: typeof evt.gas === 'number' ? evt.gas : 0,
            });
          }
          break;
        case 'projectileImpact': {
          const impactKind = typeof evt.kind === 'string' ? evt.kind : 'bullet';
          const impactTile = evt.tile && typeof evt.tile === 'object' ? evt.tile as TilePos : null;
          this.feedback.addCombatHeat(impactKind === 'rocket' ? 0.55 : 0.2);
          if (impactTile) {
            this.feedback.addImpactFlash(impactTile, impactKind === 'rocket' || impactKind === 'tracer' ? impactKind : 'bullet');
            const targetFactionId = typeof evt.targetFactionId === 'string' ? evt.targetFactionId : undefined;
            if (targetFactionId === this.localFactionId || impactKind === 'rocket') {
              const alert = {
                tile: impactTile,
                factionId: targetFactionId,
                kind: impactKind === 'rocket' ? 'critical' as const : 'impact' as const,
                severity: impactKind === 'rocket' || targetFactionId === this.localFactionId ? 'danger' as const : 'warning' as const,
              };
              this.emitter.emit('combatAlert', alert);
              this.noteCombatAlert(alert);
            }
          }
          if (impactKind === 'rocket') {
            this.audioBus.playSfx('rocket-hit');
            this.feedback.triggerHitStop(70);
          }
          break;
        }
      }
    }
  }

  private addOrderFeedback(tile: TilePos, kind: RtsOrderFeedbackKind): void {
    this.feedback.addOrderRipple(tile, kind);
  }

  private spendIfAvailable(factionId: string, cost: ResourceCost, supply: number): boolean {
    const totals = this.resources.get(factionId);
    const popState = this.supply.get(factionId);
    if (!totals || !popState) return false;
    if (totals.mineral < cost.mineral) return false;
    if (totals.gas < cost.gas) return false;
    if (popState.used + supply > popState.cap) return false;
    totals.mineral -= cost.mineral;
    totals.gas -= cost.gas;
    this.emitter.emit('resourceChanged', { factionId, mineral: totals.mineral, gas: totals.gas });
    return true;
  }

  private refundResources(factionId: string, cost: ResourceCost): void {
    const totals = this.resources.get(factionId);
    if (!totals) return;
    totals.mineral += cost.mineral;
    totals.gas += cost.gas;
    this.emitter.emit('resourceChanged', { factionId, mineral: totals.mineral, gas: totals.gas });
  }

  private spawnMapEntities(map: MapDefinition): void {
    for (const node of map.resources) {
      this.spawnResourceNode(node);
    }
    for (const spawn of map.spawns) {
      this.spawnFactionStart(spawn.factionId, spawn.tile);
    }
  }

  private spawnResourceNode(node: { id: string; kind: 'mineral' | 'gas'; tile: TilePos; amount: number }): number {
    const id = this.world.createEntity();
    this.world.addComponent<PositionComponent>(id, C.position, {
      col: node.tile.col + 0.5,
      row: node.tile.row + 0.5,
      altitude: this.grid.getAltitude(node.tile.col, node.tile.row),
    });
    this.world.addComponent<ResourceNodeComponent>(id, C.resourceNode, {
      kind: node.kind,
      amount: node.amount,
      origin: node.tile,
    });
    this.world.addComponent<RenderableComponent>(id, C.renderable, {
      kind: node.kind === 'mineral' ? 'mineral-node' : 'gas-node',
      width: 24,
      height: 24,
      tint: node.kind === 'mineral' ? 0x66bbff : 0x55ff77,
    });
    return id;
  }

  private spawnFactionStart(factionId: string, tile: TilePos): void {
    if (!this.factions.has(factionId)) {
      this.factions.set(factionId, { id: factionId, label: factionId, color: '#ffffff', isPlayer: false, isAi: false });
      this.factionIds.push(factionId);
      this.resources.set(factionId, { mineral: this.match.rules.startingResources.mineral, gas: this.match.rules.startingResources.gas });
      this.supply.set(factionId, { used: 0, cap: this.match.rules.populationCap });
      this.factionTech.set(factionId, createFactionTechState());
    }
    this.spawnBuilding('hq', factionId, tile, true);
    for (let i = 0; i < 4; i++) {
      this.spawnUnit('worker', factionId, { col: tile.col + (i % 2 === 0 ? -1 : 1), row: tile.row + (i < 2 ? -1 : 1) });
    }
  }

  spawnUnit(kind: UnitKind, factionId: string, atTile: TilePos): number {
    const stats = UNIT_STATS[kind];
    const id = this.world.createEntity();
    const safeTile = this.findOpenTile(atTile);
    this.world.addComponent<PositionComponent>(id, C.position, {
      col: safeTile.col + 0.5,
      row: safeTile.row + 0.5,
      altitude: this.grid.getAltitude(safeTile.col, safeTile.row),
    });
    this.world.addComponent<UnitComponent>(id, C.unit, { kind, speed: stats.speed, altitude: 0 });
    this.world.addComponent<FactionComponent>(id, C.faction, { factionId });
    this.world.addComponent<HealthComponent>(id, C.health, { hp: stats.hp, maxHp: stats.hp, armor: stats.armor });
    this.world.addComponent<VisionComponent>(id, C.vision, { sight: stats.sight });
    this.world.addComponent<MovementComponent>(id, C.movement, { path: [], orderMode: 'idle' });
    this.world.addComponent<CombatComponent>(id, C.combat, {
      range: stats.range,
      damage: stats.damage,
      attackPeriodMs: stats.attackPeriodMs,
      cooldownMs: 0,
      arc: stats.arc,
      projectileKind: stats.projectileKind,
      targetId: null,
    });
    this.world.addComponent<SelectableComponent>(id, C.selectable, { kind: 'unit' });
    if (kind === 'worker') {
      this.world.addComponent<WorkerComponent>(id, C.worker, {
        state: 'idle',
        carryKind: null,
        carryAmount: 0,
        capacity: stats.cargoCapacity ?? 8,
        gatherCycleMs: stats.gatherCycleMs ?? 2000,
        cycleElapsedMs: 0,
        autoGatherEnabled: true,
      });
    }
    const faction = this.factions.get(factionId);
    this.world.addComponent<RenderableComponent>(id, C.renderable, {
      kind: `unit-${kind}`,
      width: 16,
      height: 24,
      tint: hexFromColor(faction?.color ?? '#cccccc'),
    });
    this.applyFactionTechToEntity(id, factionId);
    this.recountSupply();
    this.emitter.emit('unitCreated', { entity: id, factionId, kind });
    return id;
  }

  spawnBuilding(kind: BuildingKind, factionId: string, atTile: TilePos, instant: boolean): number {
    const stats = BUILDING_STATS[kind];
    const id = this.world.createEntity();
    this.world.addComponent<PositionComponent>(id, C.position, {
      col: atTile.col + stats.footprint.cols / 2,
      row: atTile.row + stats.footprint.rows / 2,
      altitude: this.grid.getAltitude(atTile.col, atTile.row),
    });
    this.world.addComponent<BuildingComponent>(id, C.building, {
      kind,
      footprint: stats.footprint,
      origin: atTile,
      buildProgress: instant ? 1 : 0.05,
      buildTimeMs: stats.buildTimeMs,
      rallyPoint: null,
    });
    this.world.addComponent<FactionComponent>(id, C.faction, { factionId });
    this.world.addComponent<HealthComponent>(id, C.health, { hp: stats.hp, maxHp: stats.hp, armor: stats.armor });
    this.world.addComponent<VisionComponent>(id, C.vision, { sight: stats.sight });
    this.world.addComponent<SelectableComponent>(id, C.selectable, { kind: 'building' });
    if (stats.canTrain) {
      this.world.addComponent<ProductionQueueComponent>(id, C.productionQueue, { items: [] });
    }
    if (stats.canResearch) {
      this.world.addComponent<ResearchQueueComponent>(id, C.researchQueue, { items: [] });
    }
    if (stats.combat) {
      this.world.addComponent<CombatComponent>(id, C.combat, {
        range: stats.combat.range,
        damage: stats.combat.damage,
        attackPeriodMs: stats.combat.attackPeriodMs,
        cooldownMs: 0,
        arc: stats.combat.arc,
        projectileKind: stats.combat.projectileKind,
        targetId: null,
      });
    }
    const faction = this.factions.get(factionId);
    this.world.addComponent<RenderableComponent>(id, C.renderable, {
      kind: `building-${kind}`,
      width: stats.footprint.cols * 32,
      height: stats.footprint.rows * 32,
      tint: hexFromColor(faction?.color ?? '#cccccc'),
    });
    this.applyFactionTechToEntity(id, factionId);
    this.recomputeSupplyCapForFaction(factionId);
    if (instant) this.emitter.emit('buildingPlaced', { entity: id, factionId, kind });
    return id;
  }

  private isReadyProductionBuilding(producerId: number): boolean {
    const queue = this.world.getComponent<ProductionQueueComponent>(producerId, C.productionQueue);
    const faction = this.world.getComponent<FactionComponent>(producerId, C.faction);
    const building = this.world.getComponent<BuildingComponent>(producerId, C.building);
    if (!queue || !faction || !building) return false;
    if (faction.factionId !== this.localFactionId) return false;
    return building.buildProgress >= 1 && (BUILDING_STATS[building.kind].canTrain?.length ?? 0) > 0;
  }

  private canProducerTrain(producerId: number, kind: UnitKind): boolean {
    if (!this.isReadyProductionBuilding(producerId)) return false;
    const building = this.world.getComponent<BuildingComponent>(producerId, C.building);
    if (!building) return false;
    return BUILDING_STATS[building.kind].canTrain?.includes(kind) ?? false;
  }

  private enqueueResearchCandidate(researcherId: number, kind: TechKind): boolean {
    const faction = this.world.getComponent<FactionComponent>(researcherId, C.faction);
    const building = this.world.getComponent<BuildingComponent>(researcherId, C.building);
    const queue = this.world.getComponent<ResearchQueueComponent>(researcherId, C.researchQueue);
    if (!faction || !building || !queue) return false;
    if (building.buildProgress < 1) return false;
    if (!(BUILDING_STATS[building.kind].canResearch?.includes(kind) ?? false)) return false;
    if (queue.items.length > 0) return false;
    return this.canResearch(kind, faction.factionId);
  }

  private applyProducerRallyPoint(producerId: number, entityId: number): void {
    const building = this.world.getComponent<BuildingComponent>(producerId, C.building);
    if (!building?.rallyPoint) return;
    const pos = this.world.getComponent<PositionComponent>(entityId, C.position);
    const move = this.world.getComponent<MovementComponent>(entityId, C.movement);
    if (!pos || !move) return;
    const target = {
      col: Math.max(0, Math.min(this.grid.cols - 1, building.rallyPoint.col)),
      row: Math.max(0, Math.min(this.grid.rows - 1, building.rallyPoint.row)),
    };
    const path = findPath(this.grid, { col: Math.floor(pos.col), row: Math.floor(pos.row) }, target);
    move.path = path?.slice(1) ?? [];
    move.goal = target;
    move.orderMode = 'move';
    move.patrol = undefined;
    move.holdTile = undefined;
    const combat = this.world.getComponent<CombatComponent>(entityId, C.combat);
    if (combat) combat.targetId = null;
    const worker = this.world.getComponent<WorkerComponent>(entityId, C.worker);
    if (worker) {
      worker.autoGatherEnabled = false;
      worker.resourceNodeId = undefined;
    }
  }

  private spawnProjectile(
    from: { col: number; row: number; altitude: number },
    toEntity: number,
    damage: number,
    kind: 'bullet' | 'rocket' | 'tracer',
    arc: 'direct' | 'parabolic',
    factionId: string,
  ): void {
    const targetPos = this.world.getComponent<PositionComponent>(toEntity, C.position);
    if (!targetPos) return;
    const id = this.world.createEntity();
    this.world.addComponent<PositionComponent>(id, C.position, { col: from.col, row: from.row, altitude: from.altitude });
    const distance = Math.hypot(targetPos.col - from.col, targetPos.row - from.row);
    const speed = kind === 'rocket' ? 6 : 14;
    this.world.addComponent<import('./components.js').ProjectileComponent>(id, C.projectile, {
      fromCol: from.col,
      fromRow: from.row,
      toEntity,
      damage,
      speed,
      arc,
      kind,
      factionId,
      elapsedMs: 0,
      totalMs: Math.max(60, (distance / speed) * 1000),
    });
    this.world.addComponent<RenderableComponent>(id, C.renderable, {
      kind: `projectile-${kind}`,
      width: 4,
      height: 4,
      tint: kind === 'rocket' ? 0xff8855 : 0xffee44,
    });
  }

  private canPlaceBuilding(at: TilePos, footprint: { cols: number; rows: number }): boolean {
    for (let dy = 0; dy < footprint.rows; dy++) {
      for (let dx = 0; dx < footprint.cols; dx++) {
        const col = at.col + dx;
        const row = at.row + dy;
        if (!this.grid.isBuildable(col, row)) return false;
      }
    }
    // No overlap with existing buildings.
    for (const id of this.world.query([C.building, C.position])) {
      const b = this.world.getComponent<BuildingComponent>(id, C.building)!;
      const left = b.origin.col;
      const top = b.origin.row;
      const right = left + b.footprint.cols;
      const bottom = top + b.footprint.rows;
      const myRight = at.col + footprint.cols;
      const myBottom = at.row + footprint.rows;
      if (left < myRight && right > at.col && top < myBottom && bottom > at.row) return false;
    }
    return true;
  }

  /**
   * Applies the faction's accumulated tech stat bonuses to a freshly-spawned
   * entity so newly spawned units and structures inherit completed upgrades.
   */
  private applyFactionTechToEntity(entityId: number, factionId: string): void {
    const tech = this.factionTech.get(factionId);
    if (!tech) return;
    if (tech.totalArmorBonus !== 0) {
      const hp = this.world.getComponent<HealthComponent>(entityId, C.health);
      if (hp) hp.armor += tech.totalArmorBonus;
    }
    if (tech.totalDamageBonus !== 0) {
      const combat = this.world.getComponent<CombatComponent>(entityId, C.combat);
      if (combat) combat.damage += tech.totalDamageBonus;
    }
    if (tech.totalSightBonus !== 0) {
      const vision = this.world.getComponent<VisionComponent>(entityId, C.vision);
      if (vision) vision.sight += tech.totalSightBonus;
    }
  }

  private isAdjacentToGasNode(at: TilePos, footprint: { cols: number; rows: number }): boolean {
    return this.map.definition.resources.some((node) => {
      if (node.kind !== 'gas') return false;
      const left = at.col;
      const right = at.col + footprint.cols - 1;
      const top = at.row;
      const bottom = at.row + footprint.rows - 1;
      const nearCol = node.tile.col >= left - 1 && node.tile.col <= right + 1;
      const nearRow = node.tile.row >= top - 1 && node.tile.row <= bottom + 1;
      const inside = node.tile.col >= left && node.tile.col <= right && node.tile.row >= top && node.tile.row <= bottom;
      return nearCol && nearRow && !inside;
    });
  }

  private findOpenTile(near: TilePos): TilePos {
    if (this.grid.isWalkable(near.col, near.row)) return near;
    for (let r = 1; r < 6; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const col = near.col + dx;
          const row = near.row + dy;
          if (this.grid.isWalkable(col, row)) return { col, row };
        }
      }
    }
    return near;
  }

  private recountSupply(): void {
    for (const factionId of this.factionIds) {
      const popState = this.supply.get(factionId)!;
      let used = 0;
      for (const id of this.world.query([C.unit, C.faction])) {
        const f = this.world.getComponent<FactionComponent>(id, C.faction)!;
        if (f.factionId !== factionId) continue;
        const u = this.world.getComponent<UnitComponent>(id, C.unit)!;
        used += UNIT_STATS[u.kind].supply;
      }
      popState.used = used;
    }
  }

  private recomputeSupplyCapForFaction(factionId: string): void {
    const popState = this.supply.get(factionId);
    if (!popState) return;
    let cap = this.match.rules.populationCap;
    for (const id of this.world.query([C.building, C.faction])) {
      const f = this.world.getComponent<FactionComponent>(id, C.faction)!;
      if (f.factionId !== factionId) continue;
      const b = this.world.getComponent<BuildingComponent>(id, C.building)!;
      if (b.buildProgress < 1) continue;
      const stats = BUILDING_STATS[b.kind];
      cap += stats.supplyProvided ?? 0;
    }
    popState.cap = cap;
  }

  private checkVictory(): void {
    if (this.finished) return;
    const aliveByFaction = new Map<string, boolean>();
    for (const id of this.world.query([C.faction])) {
      const f = this.world.getComponent<FactionComponent>(id, C.faction)!;
      const hasBuilding = this.world.hasComponent(id, C.building);
      const hasUnit = this.world.hasComponent(id, C.unit);
      if (hasBuilding || hasUnit) aliveByFaction.set(f.factionId, true);
    }
    const survivors = this.factionIds.filter((id) => aliveByFaction.get(id));
    if (survivors.length <= 1) {
      this.finished = true;
      const winner = survivors[0] ?? 'draw';
      this.mission.result = winner === this.localFactionId ? 'victory' : 'defeat';
      if (winner === this.localFactionId) this.audioBus.playSfx('victory');
      else this.audioBus.playSfx('defeat');
      this.feedback.triggerHitStop(140);
      this.emitter.emit('matchEnded', { winner, durationMs: this.elapsedMs });
      this.emitMissionUpdatedIfChanged(true);
      this.stop();
    }
  }

  private render(): void {
    if (!this.renderer) return;
    const entities: RtsRendererSnapshot['entities'] = [];
    for (const id of this.world.query([C.position, C.renderable])) {
      const pos = this.world.getComponent<PositionComponent>(id, C.position)!;
      const renderable = this.world.getComponent<RenderableComponent>(id, C.renderable)!;
      const f = this.world.getComponent<FactionComponent>(id, C.faction);
      const hp = this.world.getComponent<HealthComponent>(id, C.health);
      const building = this.world.getComponent<BuildingComponent>(id, C.building);
      entities.push({
        id,
        col: pos.col,
        row: pos.row,
        altitude: pos.altitude,
        width: renderable.width,
        height: renderable.height,
        tint: renderable.tint,
        kind: renderable.kind,
        factionId: f?.factionId,
        selected: this.selection.has(id),
        hpRatio: hp ? hp.hp / hp.maxHp : undefined,
        buildProgress: building?.buildProgress,
      });
    }
    this.renderer.render({
      cameraTile: this.cameraTile,
      cameraZoom: this.cameraZoom,
      entities,
      fog: this.fogSystem.snapshots.get(this.localFactionId),
      fogFactionId: this.localFactionId,
      feedback: this.feedback.read(),
    });
  }
}

function formatMissionClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function titleCase(input: string): string {
  return input
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function hexFromColor(input: string): number {
  if (input.startsWith('#')) {
    const slice = input.slice(1);
    const value = slice.length === 3
      ? slice.split('').map((c) => c + c).join('')
      : slice;
    return parseInt(value, 16) || 0xffffff;
  }
  return 0xffffff;
}
