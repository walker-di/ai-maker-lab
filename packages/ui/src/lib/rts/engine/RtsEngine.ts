import {
  BUILDING_STATS,
  TUNABLES,
  UNIT_STATS,
  type BuildingKind,
  type Faction,
  type MapDefinition,
  type MatchDefinition,
  type ResourceCost,
  type ResolvedRtsMap,
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
  ResourceNodeComponent,
  SelectableComponent,
  UnitComponent,
  VisionComponent,
  WorkerComponent,
} from './components.js';
import { EngineEmitter } from './events.js';
import { FixedStepLoop } from './fixed-step-loop.js';
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
  }[];
  fog?: FogOfWarSnapshot;
  fogFactionId?: string;
}

export interface RtsRenderer {
  mount(container: HTMLDivElement | HTMLCanvasElement): Promise<void>;
  loadMap(map: MapDefinition): void;
  render(snapshot: RtsRendererSnapshot): void;
  dispose(): void;
}

export interface RtsEngineConfig {
  match: MatchDefinition;
  map: ResolvedRtsMap;
  fixedStepHz?: number;
  rendererFactory?: () => Promise<RtsRenderer>;
  /** When `true`, skip particles/screen-shake. */
  lowJuice?: boolean;
}

export interface RtsResourceState {
  mineral: number;
  gas: number;
  supplyUsed: number;
  supplyCap: number;
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
  private readonly factionIds: string[];
  private readonly factions: Map<string, Faction>;
  private renderer: RtsRenderer | null = null;
  private rendererFactory?: () => Promise<RtsRenderer>;
  private readonly fogSystem: FogOfWarSystem;
  private systems: System[] = [];
  private selection = new Set<number>();
  private cameraTile = { col: 0, row: 0 };
  private cameraZoom = 1;
  private running = false;
  private rafHandle: number | null = null;
  private elapsedMs = 0;
  private finished = false;
  private localFactionId: string;

  constructor(config: RtsEngineConfig) {
    this.match = config.match;
    this.map = config.map;
    this.grid = new TileGrid(config.map.definition);
    this.loop = new FixedStepLoop({ hz: config.fixedStepHz ?? 30 });
    this.factionIds = config.match.factions.map((f) => f.id);
    this.factions = new Map(config.match.factions.map((f) => [f.id, f]));
    this.fogSystem = new FogOfWarSystem(this.grid, this.factionIds);
    this.rendererFactory = config.rendererFactory;
    this.localFactionId =
      config.match.factions.find((f) => f.isPlayer)?.id ?? config.match.factions[0]!.id;

    for (const faction of config.match.factions) {
      this.resources.set(faction.id, {
        mineral: config.match.rules.startingResources.mineral,
        gas: config.match.rules.startingResources.gas,
      });
      this.supply.set(faction.id, { used: 0, cap: config.match.rules.populationCap });
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
    this.loop.tick(seconds, () => this.runFixedStep());
    this.render();
  }

  /** For headless tests: advance one fixed step. */
  tickFixed(): void {
    this.runFixedStep();
  }

  // ---------------------------------------------------------------------------
  // Public commands
  // ---------------------------------------------------------------------------

  selectByIds(ids: number[]): void {
    this.selection = new Set(ids.filter((id) => this.world.isAlive(id)));
    this.emitter.emit('selectionChanged', { entityIds: [...this.selection] });
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
  }

  orderMoveSelectionTo(target: TilePos): void {
    for (const id of this.selection) {
      const pos = this.world.getComponent<PositionComponent>(id, C.position);
      const move = this.world.getComponent<MovementComponent>(id, C.movement);
      if (!pos || !move) continue;
      const path = findPath(this.grid, { col: Math.floor(pos.col), row: Math.floor(pos.row) }, target);
      move.path = path?.slice(1) ?? [];
      move.goal = target;
    }
  }

  orderAttackTarget(targetId: number): void {
    for (const id of this.selection) {
      const combat = this.world.getComponent<CombatComponent>(id, C.combat);
      if (combat) combat.targetId = targetId;
    }
  }

  orderHarvest(nodeId: number): void {
    for (const id of this.selection) {
      const worker = this.world.getComponent<WorkerComponent>(id, C.worker);
      if (!worker) continue;
      worker.resourceNodeId = nodeId;
      worker.state = 'movingToResource';
      const pos = this.world.getComponent<PositionComponent>(id, C.position)!;
      const move = this.world.getComponent<MovementComponent>(id, C.movement)!;
      const target = this.world.getComponent<PositionComponent>(nodeId, C.position);
      if (!target) continue;
      const tile = { col: Math.floor(target.col), row: Math.floor(target.row) };
      const path = findPath(this.grid, { col: Math.floor(pos.col), row: Math.floor(pos.row) }, tile);
      move.path = path?.slice(1) ?? [];
      move.goal = tile;
    }
  }

  enqueueProduction(producerId: number, kind: UnitKind): boolean {
    const queue = this.world.getComponent<ProductionQueueComponent>(producerId, C.productionQueue);
    const faction = this.world.getComponent<FactionComponent>(producerId, C.faction);
    if (!queue || !faction) return false;
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
    return true;
  }

  placeBuilding(factionId: string, kind: BuildingKind, atTile: TilePos): number | null {
    const stats = BUILDING_STATS[kind];
    if (!this.canPlaceBuilding(atTile, stats.footprint)) return null;
    if (!this.spendIfAvailable(factionId, stats.cost, 0)) return null;
    return this.spawnBuilding(kind, factionId, atTile, false);
  }

  // ---------------------------------------------------------------------------
  // Read-only state
  // ---------------------------------------------------------------------------

  getSelection(): number[] { return [...this.selection]; }
  getResources(factionId: string): RtsResourceState {
    const totals = this.resources.get(factionId) ?? { mineral: 0, gas: 0 };
    const supply = this.supply.get(factionId) ?? { used: 0, cap: TUNABLES.defaultPopulationCap };
    return { ...totals, supplyUsed: supply.used, supplyCap: supply.cap };
  }
  getLocalFactionId(): string { return this.localFactionId; }
  getFog(factionId: string): FogOfWarSnapshot | undefined {
    return this.fogSystem.snapshots.get(factionId);
  }
  getElapsedMs(): number { return this.elapsedMs; }
  getCameraTile(): TilePos { return { ...this.cameraTile }; }
  setCameraTile(tile: TilePos): void { this.cameraTile = { ...tile }; }
  panCamera(dCol: number, dRow: number): void {
    this.cameraTile.col = Math.max(0, Math.min(this.grid.cols - 1, this.cameraTile.col + dCol));
    this.cameraTile.row = Math.max(0, Math.min(this.grid.rows - 1, this.cameraTile.row + dRow));
  }
  zoomBy(factor: number): void {
    this.cameraZoom = Math.max(0.5, Math.min(2.5, this.cameraZoom * factor));
  }

  isFinished(): boolean { return this.finished; }

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
      new ProductionSystem(this.resources, (kind, factionId, atTile) => this.spawnUnit(kind, factionId, atTile)),
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
  }

  private processEvents(): void {
    for (const evt of this.bus.drain()) {
      switch (evt.type) {
        case 'death': {
          if (typeof evt.entity === 'number') {
            this.emitter.emit('unitKilled', {
              entity: evt.entity,
              factionId: typeof evt.factionId === 'string' ? evt.factionId : 'unknown',
            });
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
            this.recountSupply();
          }
          break;
        case 'buildingCompleted':
          if (typeof evt.entity === 'number' && typeof evt.factionId === 'string' && typeof evt.kind === 'string') {
            this.emitter.emit('buildingPlaced', { entity: evt.entity, factionId: evt.factionId, kind: evt.kind });
            this.recomputeSupplyCapForFaction(evt.factionId);
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
      }
    }
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
    this.world.addComponent<MovementComponent>(id, C.movement, { path: [] });
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
      });
    }
    const faction = this.factions.get(factionId);
    this.world.addComponent<RenderableComponent>(id, C.renderable, {
      kind: `unit-${kind}`,
      width: 16,
      height: 24,
      tint: hexFromColor(faction?.color ?? '#cccccc'),
    });
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
    });
    this.world.addComponent<FactionComponent>(id, C.faction, { factionId });
    this.world.addComponent<HealthComponent>(id, C.health, { hp: stats.hp, maxHp: stats.hp, armor: stats.armor });
    this.world.addComponent<VisionComponent>(id, C.vision, { sight: stats.sight });
    this.world.addComponent<SelectableComponent>(id, C.selectable, { kind: 'building' });
    if (stats.canTrain) {
      this.world.addComponent<ProductionQueueComponent>(id, C.productionQueue, { items: [] });
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
    this.recomputeSupplyCapForFaction(factionId);
    if (instant) this.emitter.emit('buildingPlaced', { entity: id, factionId, kind });
    return id;
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
      this.emitter.emit('matchEnded', { winner, durationMs: this.elapsedMs });
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
      });
    }
    this.renderer.render({
      cameraTile: this.cameraTile,
      cameraZoom: this.cameraZoom,
      entities,
      fog: this.fogSystem.snapshots.get(this.localFactionId),
      fogFactionId: this.localFactionId,
    });
  }
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
