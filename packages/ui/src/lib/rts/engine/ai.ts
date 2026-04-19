import type { AiDifficulty, BuildingKind, TilePos, UnitKind } from '../types.js';
import { BUILDING_STATS } from '../types.js';
import type { RtsEngine } from './RtsEngine.js';
import { COMPONENT_KINDS as C } from './components.js';
import type {
  BuildingComponent,
  FactionComponent,
  PositionComponent,
  ProductionQueueComponent,
  WorkerComponent,
} from './components.js';
import { SeededRng } from './rng.js';

interface DirectorState {
  lastTickMs: number;
}

const DIFFICULTY_TICK_MS: Record<AiDifficulty, number> = {
  easy: 4000,
  normal: 2000,
  hard: 800,
};

const DIFFICULTY_AGGRESSION: Record<AiDifficulty, number> = {
  easy: 0.3,
  normal: 0.6,
  hard: 1.0,
};

interface BuildOrderStep {
  kind: UnitKind | BuildingKind;
  isUnit: boolean;
}

const BASE_BUILD_ORDER: BuildOrderStep[] = [
  { kind: 'worker', isUnit: true },
  { kind: 'worker', isUnit: true },
  { kind: 'depot', isUnit: false },
  { kind: 'barracks', isUnit: false },
  { kind: 'rifleman', isUnit: true },
  { kind: 'rifleman', isUnit: true },
  { kind: 'depot', isUnit: false },
  { kind: 'rifleman', isUnit: true },
  { kind: 'rifleman', isUnit: true },
  { kind: 'rifleman', isUnit: true },
];

/**
 * Scripted RTS opponent. Implements the four directors from the plan
 * (Economy, BuildOrder, Military, Scout) as composed methods on the
 * controller. Difficulty modulates tick cadence and aggression only.
 */
export class AiController {
  private readonly rng: SeededRng;
  private readonly buildOrder: BuildOrderStep[];
  private buildOrderIndex = 0;
  private state: DirectorState = { lastTickMs: 0 };
  private attacked = false;
  private waveIndex = 0;

  constructor(
    private readonly engine: RtsEngine,
    private readonly factionId: string,
    private readonly difficulty: AiDifficulty,
    seed: number,
  ) {
    this.rng = SeededRng.fromString(`${factionId}-ai`, seed);
    this.buildOrder = [...BASE_BUILD_ORDER];
  }

  tick(nowMs: number): void {
    const tickMs = DIFFICULTY_TICK_MS[this.difficulty];
    if (nowMs - this.state.lastTickMs < tickMs) return;
    this.state.lastTickMs = nowMs;
    this.economyDirector();
    this.buildOrderDirector();
    this.militaryDirector(nowMs);
    this.scoutDirector();
  }

  // --- Directors --------------------------------------------------------------

  private economyDirector(): void {
    for (const id of this.engine.world.query([C.worker, C.faction])) {
      const f = this.engine.world.getComponent<FactionComponent>(id, C.faction)!;
      if (f.factionId !== this.factionId) continue;
      const worker = this.engine.world.getComponent<WorkerComponent>(id, C.worker)!;
      if (worker.state !== 'idle') continue;
      this.engine.selectByIds([id]);
      const node = this.findNearestResourceForFaction();
      if (node) this.engine.orderHarvest(node);
    }
    this.engine.selectByIds([]);
  }

  private buildOrderDirector(): void {
    const step = this.buildOrder[this.buildOrderIndex];
    if (!step) return;
    if (step.isUnit) {
      const producer = this.findProducerFor(step.kind as UnitKind);
      if (!producer) return;
      const ok = this.engine.enqueueProduction(producer, step.kind as UnitKind);
      if (ok) this.buildOrderIndex++;
    } else {
      const tile = this.findBuildSite(step.kind as BuildingKind);
      if (!tile) return;
      const ok = this.engine.placeBuilding(this.factionId, step.kind as BuildingKind, tile);
      if (ok != null) this.buildOrderIndex++;
    }
  }

  private militaryDirector(nowMs: number): void {
    if (this.buildOrderIndex < 4) return;
    const aggression = DIFFICULTY_AGGRESSION[this.difficulty];
    const myUnits = this.collectMyUnits();
    const minWaveSize = Math.max(2, Math.round(4 * aggression));
    if (myUnits.length < minWaveSize) return;
    const enemyTarget = this.findEnemyTarget();
    if (!enemyTarget) return;
    if (!this.attacked || nowMs - this.state.lastTickMs >= 0) {
      this.engine.selectByIds(myUnits);
      this.engine.orderMoveSelectionTo(enemyTarget);
      this.engine.selectByIds([]);
      this.attacked = true;
      this.waveIndex++;
    }
  }

  private scoutDirector(): void {
    if (this.rng.float() > 0.5) return;
    const scouts = this.collectScouts();
    if (scouts.length === 0) return;
    const target = this.randomReachableTile();
    if (!target) return;
    this.engine.selectByIds([scouts[0]!]);
    this.engine.orderMoveSelectionTo(target);
    this.engine.selectByIds([]);
  }

  // --- Helpers ----------------------------------------------------------------

  private collectMyUnits(): number[] {
    const out: number[] = [];
    for (const id of this.engine.world.query([C.unit, C.faction])) {
      const f = this.engine.world.getComponent<FactionComponent>(id, C.faction)!;
      if (f.factionId !== this.factionId) continue;
      // Workers stay home.
      if (this.engine.world.hasComponent(id, C.worker)) continue;
      out.push(id);
    }
    return out;
  }

  private collectScouts(): number[] {
    const out: number[] = [];
    for (const id of this.engine.world.query([C.unit, C.faction])) {
      const f = this.engine.world.getComponent<FactionComponent>(id, C.faction)!;
      if (f.factionId !== this.factionId) continue;
      const u = this.engine.world.getComponent<import('./components.js').UnitComponent>(id, C.unit)!;
      if (u.kind === 'scout') out.push(id);
    }
    return out;
  }

  private findNearestResourceForFaction(): number | null {
    let best: number | null = null;
    let bestD2 = Infinity;
    const hq = this.findHomeBase();
    if (!hq) return null;
    const hqPos = this.engine.world.getComponent<PositionComponent>(hq, C.position)!;
    for (const id of this.engine.world.query([C.resourceNode, C.position])) {
      const p = this.engine.world.getComponent<PositionComponent>(id, C.position)!;
      const d2 = (p.col - hqPos.col) ** 2 + (p.row - hqPos.row) ** 2;
      if (d2 < bestD2) { bestD2 = d2; best = id; }
    }
    return best;
  }

  private findProducerFor(kind: UnitKind): number | null {
    for (const id of this.engine.world.query([C.building, C.faction, C.productionQueue])) {
      const f = this.engine.world.getComponent<FactionComponent>(id, C.faction)!;
      if (f.factionId !== this.factionId) continue;
      const b = this.engine.world.getComponent<BuildingComponent>(id, C.building)!;
      if (b.buildProgress < 1) continue;
      const stats = BUILDING_STATS[b.kind];
      if (!stats.canTrain?.includes(kind)) continue;
      const q = this.engine.world.getComponent<ProductionQueueComponent>(id, C.productionQueue)!;
      if (q.items.length < 3) return id;
    }
    return null;
  }

  private findHomeBase(): number | null {
    for (const id of this.engine.world.query([C.building, C.faction])) {
      const f = this.engine.world.getComponent<FactionComponent>(id, C.faction)!;
      if (f.factionId !== this.factionId) continue;
      const b = this.engine.world.getComponent<BuildingComponent>(id, C.building)!;
      if (b.kind === 'hq') return id;
    }
    return null;
  }

  private findBuildSite(kind: BuildingKind): TilePos | null {
    const hq = this.findHomeBase();
    if (!hq) return null;
    const pos = this.engine.world.getComponent<PositionComponent>(hq, C.position)!;
    const stats = BUILDING_STATS[kind];
    for (let r = 2; r < 12; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const at = { col: Math.floor(pos.col + dx), row: Math.floor(pos.row + dy) };
          if (this.engine['canPlaceBuilding'] && (this.engine as unknown as {
            canPlaceBuilding: (a: TilePos, f: { cols: number; rows: number }) => boolean;
          }).canPlaceBuilding(at, stats.footprint)) {
            return at;
          }
          // Fallback when private not exposed: simple buildable check.
          if (this.engine.grid.isBuildable(at.col, at.row) && this.engine.grid.isBuildable(at.col + 1, at.row + 1)) {
            return at;
          }
        }
      }
    }
    return null;
  }

  private findEnemyTarget(): TilePos | null {
    for (const id of this.engine.world.query([C.building, C.faction, C.position])) {
      const f = this.engine.world.getComponent<FactionComponent>(id, C.faction)!;
      if (f.factionId === this.factionId) continue;
      const p = this.engine.world.getComponent<PositionComponent>(id, C.position)!;
      return { col: Math.floor(p.col), row: Math.floor(p.row) };
    }
    // Fall back to enemy spawn from match map.
    for (const spawn of this.engine.map.definition.spawns) {
      if (spawn.factionId !== this.factionId) return spawn.tile;
    }
    return null;
  }

  private randomReachableTile(): TilePos | null {
    const grid = this.engine.grid;
    for (let attempts = 0; attempts < 16; attempts++) {
      const col = this.rng.int(0, grid.cols - 1);
      const row = this.rng.int(0, grid.rows - 1);
      if (grid.isWalkable(col, row)) return { col, row };
    }
    return null;
  }
}
