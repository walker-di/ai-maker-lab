import type { Entity } from './world.js';

/**
 * Engine event payloads. Downstream plans add their own event variants by
 * extending the engine emitter with discriminated payloads of their own; the
 * emitter is intentionally typed openly via the map below so plan 02-07 can
 * grow it without modifying this file's source.
 */
export interface EngineEventMap {
  arenaLoaded: { arenaId: string; chunkCount: number };
  arenaUnloaded: { arenaId: string };
  agentSpawned: { entity: Entity; spawnId: string; tag: string };
  agentDied: { entity: Entity; reason: string };
  agentReachedGoal: { entity: Entity; goalId?: string };
  entityConsumed: { entity: Entity; consumerEntity?: Entity };
  simStep: { stepIndex: number; stepDt: number };
  renderFrame: { alpha: number; fps: number };
  paused: { paused: boolean };
}

export type EngineEvent = {
  [K in keyof EngineEventMap]: { type: K; payload: EngineEventMap[K] };
}[keyof EngineEventMap];

export type EngineEventListener<K extends keyof EngineEventMap = keyof EngineEventMap> = (
  payload: EngineEventMap[K],
) => void;

/**
 * Tiny typed emitter, dependency-free. The voxsim engine instantiates one and
 * forwards drained `SystemEventBus` events into it.
 */
export class EngineEmitter {
  private listeners: Map<keyof EngineEventMap, Set<EngineEventListener>> = new Map();

  on<K extends keyof EngineEventMap>(type: K, listener: EngineEventListener<K>): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener as EngineEventListener);
    return () => {
      this.listeners.get(type)?.delete(listener as EngineEventListener);
    };
  }

  emit<K extends keyof EngineEventMap>(type: K, payload: EngineEventMap[K]): void {
    const set = this.listeners.get(type);
    if (!set) return;
    for (const fn of set) (fn as EngineEventListener<K>)(payload);
  }

  removeAll(): void {
    this.listeners.clear();
  }
}
