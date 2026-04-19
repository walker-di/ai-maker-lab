import type { TilePos } from '../types.js';
import { TUNABLES } from '../types.js';
import { COMPONENT_KINDS as C } from './components.js';
import type {
  CombatComponent,
  FactionComponent,
  HealthComponent,
  MovementComponent,
  PositionComponent,
  ProductionQueueComponent,
  ProjectileComponent,
  ResourceNodeComponent,
  UnitComponent,
  VisionComponent,
  WorkerComponent,
} from './components.js';
import type { EngineWorld, System, SystemContext } from './world.js';
import { findPath } from './pathfinding.js';
import type { TileGrid } from './tile-grid.js';

const TILE_EPS = 0.04;

export class MovementSystem implements System {
  readonly name = 'movement';
  constructor(private readonly grid: TileGrid) {}

  update(world: EngineWorld, dt: number, _ctx: SystemContext): void {
    for (const id of world.query([C.position, C.movement, C.unit])) {
      const pos = world.getComponent<PositionComponent>(id, C.position)!;
      const move = world.getComponent<MovementComponent>(id, C.movement)!;
      const unit = world.getComponent<UnitComponent>(id, C.unit)!;
      if (move.path.length === 0) continue;
      const target = move.path[0]!;
      const dx = target.col + 0.5 - pos.col;
      const dy = target.row + 0.5 - pos.row;
      const dist = Math.hypot(dx, dy);
      if (dist < TILE_EPS) {
        move.path.shift();
        pos.col = target.col + 0.5;
        pos.row = target.row + 0.5;
        pos.altitude = this.grid.getAltitude(target.col, target.row);
        continue;
      }
      const step = unit.speed * dt;
      const move_ratio = Math.min(1, step / dist);
      pos.col += dx * move_ratio;
      pos.row += dy * move_ratio;
      pos.altitude = this.grid.getAltitude(Math.round(pos.col - 0.5), Math.round(pos.row - 0.5));
    }
  }
}

export class CombatSystem implements System {
  readonly name = 'combat';
  constructor(
    private readonly grid: TileGrid,
    private readonly spawnProjectile: (
      from: { col: number; row: number; altitude: number },
      toEntity: number,
      damage: number,
      kind: 'bullet' | 'rocket' | 'tracer',
      arc: 'direct' | 'parabolic',
      factionId: string,
    ) => void,
  ) {}

  update(world: EngineWorld, dt: number, _ctx: SystemContext): void {
    const dtMs = dt * 1000;
    for (const id of world.query([C.position, C.combat, C.faction])) {
      const combat = world.getComponent<CombatComponent>(id, C.combat)!;
      const pos = world.getComponent<PositionComponent>(id, C.position)!;
      const faction = world.getComponent<FactionComponent>(id, C.faction)!;
      combat.cooldownMs = Math.max(0, combat.cooldownMs - dtMs);
      if (!combat.targetId || !world.isAlive(combat.targetId)) {
        combat.targetId = findNearestEnemy(world, pos, faction.factionId, combat.range + 2);
      }
      if (!combat.targetId) continue;
      const targetPos = world.getComponent<PositionComponent>(combat.targetId, C.position);
      if (!targetPos) {
        combat.targetId = null;
        continue;
      }
      const altitudeBonus = TUNABLES.altitudeRangeBonusPerLevel * Math.max(0, pos.altitude - targetPos.altitude);
      const range = combat.range + altitudeBonus;
      const dx = targetPos.col - pos.col;
      const dy = targetPos.row - pos.row;
      const distance = Math.hypot(dx, dy);
      if (distance > range) {
        // Out of range; move owner toward target if it's a unit.
        const move = world.getComponent<MovementComponent>(id, C.movement);
        if (move && move.path.length === 0) {
          const path = findPath(this.grid, { col: Math.floor(pos.col), row: Math.floor(pos.row) }, { col: Math.floor(targetPos.col), row: Math.floor(targetPos.row) });
          if (path) move.path = path.slice(1);
        }
        continue;
      }
      if (combat.cooldownMs > 0) continue;
      // Fire.
      const damage = combat.damage * (1 + TUNABLES.altitudeDamageBonusPerLevel * Math.max(0, pos.altitude - targetPos.altitude));
      this.spawnProjectile({ col: pos.col, row: pos.row, altitude: pos.altitude }, combat.targetId, damage, combat.projectileKind, combat.arc, faction.factionId);
      combat.cooldownMs = combat.attackPeriodMs;
    }
  }
}

function findNearestEnemy(world: EngineWorld, pos: PositionComponent, factionId: string, maxDist: number): number | null {
  let bestId: number | null = null;
  let bestD2 = maxDist * maxDist;
  for (const id of world.query([C.position, C.faction, C.health])) {
    const f = world.getComponent<FactionComponent>(id, C.faction)!;
    if (f.factionId === factionId) continue;
    const p = world.getComponent<PositionComponent>(id, C.position)!;
    const d2 = (p.col - pos.col) ** 2 + (p.row - pos.row) ** 2;
    if (d2 < bestD2) {
      bestD2 = d2;
      bestId = id;
    }
  }
  return bestId;
}

export class ProjectileSystem implements System {
  readonly name = 'projectile';
  update(world: EngineWorld, dt: number, _ctx: SystemContext): void {
    const dtMs = dt * 1000;
    for (const id of world.query([C.projectile])) {
      const proj = world.getComponent<ProjectileComponent>(id, C.projectile)!;
      proj.elapsedMs += dtMs;
      if (proj.elapsedMs >= proj.totalMs) {
        if (world.isAlive(proj.toEntity)) {
          const hp = world.getComponent<HealthComponent>(proj.toEntity, C.health);
          if (hp) {
            const reduced = Math.max(1, proj.damage - hp.armor);
            hp.hp -= reduced;
          }
        }
        world.removeEntity(id);
      }
    }
  }
}

export class HealthSystem implements System {
  readonly name = 'health';
  update(world: EngineWorld, _dt: number, ctx: SystemContext): void {
    for (const id of world.query([C.health])) {
      const hp = world.getComponent<HealthComponent>(id, C.health)!;
      if (hp.hp > 0) continue;
      const faction = world.getComponent<FactionComponent>(id, C.faction);
      ctx.bus.emit({ type: 'death', entity: id, factionId: faction?.factionId });
      world.removeEntity(id);
    }
  }
}

export class WorkerSystem implements System {
  readonly name = 'worker';
  constructor(
    private readonly grid: TileGrid,
    private readonly resources: Map<string, { mineral: number; gas: number }>,
  ) {}

  update(world: EngineWorld, dt: number, ctx: SystemContext): void {
    const dtMs = dt * 1000;
    for (const id of world.query([C.worker, C.position, C.faction, C.movement, C.unit])) {
      const worker = world.getComponent<WorkerComponent>(id, C.worker)!;
      const pos = world.getComponent<PositionComponent>(id, C.position)!;
      const faction = world.getComponent<FactionComponent>(id, C.faction)!;
      const move = world.getComponent<MovementComponent>(id, C.movement)!;

      switch (worker.state) {
        case 'idle':
          if (worker.resourceNodeId == null || !world.isAlive(worker.resourceNodeId)) {
            const node = findNearestResourceNode(world, pos);
            if (!node) break;
            worker.resourceNodeId = node;
          }
          worker.state = 'movingToResource';
          this.routeTo(world, id, this.entityTile(world, worker.resourceNodeId!));
          break;
        case 'movingToResource': {
          if (move.path.length > 0) break;
          const node = world.getComponent<ResourceNodeComponent>(worker.resourceNodeId!, C.resourceNode);
          if (!node || node.amount <= 0) {
            worker.state = 'idle';
            worker.resourceNodeId = undefined;
            break;
          }
          worker.state = 'gathering';
          worker.cycleElapsedMs = 0;
          break;
        }
        case 'gathering': {
          worker.cycleElapsedMs += dtMs;
          if (worker.cycleElapsedMs < worker.gatherCycleMs) break;
          const node = world.getComponent<ResourceNodeComponent>(worker.resourceNodeId!, C.resourceNode);
          if (!node || node.amount <= 0) {
            worker.state = 'idle';
            worker.resourceNodeId = undefined;
            break;
          }
          const taken = Math.min(worker.capacity, node.amount);
          node.amount -= taken;
          worker.carryAmount = taken;
          worker.carryKind = node.kind;
          if (node.amount <= 0) {
            const death = node;
            ctx.bus.emit({ type: 'resourceDepleted', nodeId: worker.resourceNodeId });
            void death;
            world.removeEntity(worker.resourceNodeId!);
            worker.resourceNodeId = undefined;
          }
          // Find depot
          const depotId = findNearestDepot(world, pos, faction.factionId);
          if (!depotId) {
            worker.state = 'idle';
            break;
          }
          worker.depotId = depotId;
          worker.state = 'returning';
          this.routeTo(world, id, this.entityTile(world, depotId));
          break;
        }
        case 'returning': {
          if (move.path.length > 0) break;
          const totals = this.resources.get(faction.factionId) ?? { mineral: 0, gas: 0 };
          if (worker.carryKind === 'mineral') totals.mineral += worker.carryAmount;
          else if (worker.carryKind === 'gas') totals.gas += worker.carryAmount;
          this.resources.set(faction.factionId, totals);
          ctx.bus.emit({ type: 'resourceChanged', factionId: faction.factionId, mineral: totals.mineral, gas: totals.gas });
          worker.carryAmount = 0;
          worker.carryKind = null;
          worker.state = 'idle';
          break;
        }
      }
    }
  }

  private entityTile(world: EngineWorld, id: number): TilePos {
    const pos = world.getComponent<PositionComponent>(id, C.position);
    if (!pos) return { col: 0, row: 0 };
    return { col: Math.floor(pos.col), row: Math.floor(pos.row) };
  }

  private routeTo(world: EngineWorld, id: number, target: TilePos): void {
    const pos = world.getComponent<PositionComponent>(id, C.position)!;
    const move = world.getComponent<MovementComponent>(id, C.movement)!;
    const path = findPath(this.grid, { col: Math.floor(pos.col), row: Math.floor(pos.row) }, target);
    move.path = path?.slice(1) ?? [];
    move.goal = target;
  }
}

function findNearestResourceNode(world: EngineWorld, pos: PositionComponent): number | null {
  let bestId: number | null = null;
  let bestD2 = Infinity;
  for (const id of world.query([C.resourceNode, C.position])) {
    const p = world.getComponent<PositionComponent>(id, C.position)!;
    const d2 = (p.col - pos.col) ** 2 + (p.row - pos.row) ** 2;
    if (d2 < bestD2) {
      bestD2 = d2;
      bestId = id;
    }
  }
  return bestId;
}

function findNearestDepot(world: EngineWorld, pos: PositionComponent, factionId: string): number | null {
  let bestId: number | null = null;
  let bestD2 = Infinity;
  for (const id of world.query([C.building, C.position, C.faction])) {
    const f = world.getComponent<FactionComponent>(id, C.faction)!;
    if (f.factionId !== factionId) continue;
    const b = world.getComponent<import('./components.js').BuildingComponent>(id, C.building)!;
    if (b.kind !== 'hq' && b.kind !== 'refinery' && b.kind !== 'depot') continue;
    if (b.buildProgress < 1) continue;
    const p = world.getComponent<PositionComponent>(id, C.position)!;
    const d2 = (p.col - pos.col) ** 2 + (p.row - pos.row) ** 2;
    if (d2 < bestD2) {
      bestD2 = d2;
      bestId = id;
    }
  }
  return bestId;
}

export class ProductionSystem implements System {
  readonly name = 'production';
  constructor(
    private readonly resources: Map<string, { mineral: number; gas: number }>,
    private readonly spawnUnit: (
      kind: import('../types.js').UnitKind,
      factionId: string,
      atTile: TilePos,
    ) => number,
  ) {}

  update(world: EngineWorld, dt: number, ctx: SystemContext): void {
    const dtMs = dt * 1000;
    for (const id of world.query([C.productionQueue, C.faction, C.position, C.building])) {
      const queue = world.getComponent<ProductionQueueComponent>(id, C.productionQueue)!;
      const faction = world.getComponent<FactionComponent>(id, C.faction)!;
      const pos = world.getComponent<PositionComponent>(id, C.position)!;
      const building = world.getComponent<import('./components.js').BuildingComponent>(id, C.building)!;
      if (building.buildProgress < 1) continue;
      if (queue.items.length === 0) continue;
      const item = queue.items[0]!;
      item.remainingMs -= dtMs;
      if (item.remainingMs > 0) continue;
      queue.items.shift();
      if (item.isUnit) {
        const tile = { col: Math.floor(pos.col + 1), row: Math.floor(pos.row + 1) };
        const entity = this.spawnUnit(item.kind as import('../types.js').UnitKind, faction.factionId, tile);
        ctx.bus.emit({ type: 'productionCompleted', factionId: faction.factionId, kind: item.kind, entity });
      }
      void this.resources; // placeholder for cost handling done at queue time
    }
  }
}

export class BuildProgressSystem implements System {
  readonly name = 'buildProgress';
  update(world: EngineWorld, dt: number, ctx: SystemContext): void {
    const dtMs = dt * 1000;
    for (const id of world.query([C.building])) {
      const b = world.getComponent<import('./components.js').BuildingComponent>(id, C.building)!;
      if (b.buildProgress >= 1) continue;
      b.buildProgress = Math.min(1, b.buildProgress + dtMs / b.buildTimeMs);
      if (b.buildProgress >= 1) {
        const f = world.getComponent<FactionComponent>(id, C.faction);
        ctx.bus.emit({ type: 'buildingCompleted', entity: id, factionId: f?.factionId, kind: b.kind });
      }
    }
  }
}

export interface FogOfWarSnapshot {
  /** 0 = unseen, 1 = explored, 2 = visible */
  cells: Uint8Array;
  cols: number;
  rows: number;
}

export class FogOfWarSystem implements System {
  readonly name = 'fog';
  readonly snapshots = new Map<string, FogOfWarSnapshot>();

  constructor(
    private readonly grid: TileGrid,
    private readonly factionIds: string[],
  ) {
    for (const f of factionIds) {
      this.snapshots.set(f, {
        cells: new Uint8Array(grid.cols * grid.rows),
        cols: grid.cols,
        rows: grid.rows,
      });
    }
  }

  update(world: EngineWorld, _dt: number, _ctx: SystemContext): void {
    for (const snap of this.snapshots.values()) {
      // Demote visible -> explored.
      for (let i = 0; i < snap.cells.length; i++) if (snap.cells[i] === 2) snap.cells[i] = 1;
    }
    for (const id of world.query([C.position, C.faction, C.vision])) {
      const pos = world.getComponent<PositionComponent>(id, C.position)!;
      const faction = world.getComponent<FactionComponent>(id, C.faction)!;
      const vis = world.getComponent<VisionComponent>(id, C.vision)!;
      const snap = this.snapshots.get(faction.factionId);
      if (!snap) continue;
      const cx = Math.floor(pos.col);
      const cy = Math.floor(pos.row);
      const r2 = vis.sight * vis.sight;
      for (let ry = -vis.sight; ry <= vis.sight; ry++) {
        for (let rx = -vis.sight; rx <= vis.sight; rx++) {
          if (rx * rx + ry * ry > r2) continue;
          const nx = cx + rx;
          const ny = cy + ry;
          if (nx < 0 || ny < 0 || nx >= snap.cols || ny >= snap.rows) continue;
          snap.cells[ny * snap.cols + nx] = 2;
        }
      }
    }
    void this.grid;
  }
}
