import type { LevelDefinition, RunOutcome, RunResult, WorldDefinition } from '../types.js';
import type { PlatformerEngine } from '../engine/PlatformerEngine.js';

export interface RunControllerCallbacks {
  onLevelLoaded(level: LevelDefinition, world: WorldDefinition): void;
  onRunFinished(result: RunResult): void;
}

/**
 * Owns linear progression through `WorldDefinition.levels[]`. The runtime
 * page model wires it up; the engine remains world-agnostic.
 */
export class RunController {
  private worldIndex = 0;
  private levelIndex = 0;
  private worlds: WorldDefinition[] = [];
  private engineUnsub: Array<() => void> = [];
  private startedAt = 0;

  constructor(
    private readonly engine: PlatformerEngine,
    private readonly callbacks: RunControllerCallbacks,
  ) {}

  setWorlds(worlds: WorldDefinition[]): void {
    this.worlds = worlds;
  }

  startWorld(worldId: string, levelId?: string): void {
    const wIdx = this.worlds.findIndex((w) => w.id === worldId);
    if (wIdx < 0) return;
    this.worldIndex = wIdx;
    if (levelId) {
      const lIdx = this.worlds[wIdx]!.levels.findIndex((l) => l.id === levelId);
      this.levelIndex = lIdx >= 0 ? lIdx : 0;
    } else {
      this.levelIndex = 0;
    }
    this.loadCurrent();
  }

  dispose(): void {
    for (const unsub of this.engineUnsub) unsub();
    this.engineUnsub = [];
  }

  private loadCurrent(): void {
    const world = this.worlds[this.worldIndex];
    const level = world?.levels[this.levelIndex];
    if (!world || !level) return;
    this.dispose();
    this.engine.loadMap(level.map);
    this.startedAt = Date.now();
    this.callbacks.onLevelLoaded(level, world);

    this.engineUnsub.push(this.engine.on('goalReached', () => {
      this.advance(world, level);
    }));
    this.engineUnsub.push(this.engine.on('runFinished', (payload) => {
      if (payload.outcome === 'gameOver') {
        this.callbacks.onRunFinished({
          worldId: world.id,
          levelId: level.id,
          outcome: 'gameOver' as RunOutcome,
          score: payload.score,
          coins: payload.coins,
          timeMs: payload.timeMs,
          completedAt: new Date().toISOString(),
        });
      }
    }));
  }

  private advance(world: WorldDefinition, level: LevelDefinition): void {
    const next = this.levelIndex + 1;
    if (next >= world.levels.length) {
      this.callbacks.onRunFinished({
        worldId: world.id,
        levelId: level.id,
        outcome: 'completed' as RunOutcome,
        score: this.engine.getScore(),
        coins: this.engine.getCoins(),
        timeMs: Date.now() - this.startedAt,
        completedAt: new Date().toISOString(),
      });
      return;
    }
    this.levelIndex = next;
    this.loadCurrent();
  }
}
