import type { PowerUpKind, RunOutcome } from '../types.js';

export type EngineEventMap = {
  score: { delta: number; total: number };
  coin: { total: number };
  lifeLost: { lives: number };
  goalReached: { score: number; coins: number; timeMs: number };
  powerUp: { power: PowerUpKind };
  hazardHit: { col: number; row: number };
  runFinished: { outcome: RunOutcome; score: number; coins: number; timeMs: number };
  pause: { paused: boolean };
  pipeTeleport: { from: { col: number; row: number }; to: { col: number; row: number } };
};

export type EngineEvent = {
  [K in keyof EngineEventMap]: { type: K; payload: EngineEventMap[K] };
}[keyof EngineEventMap];

export type EngineEventListener<K extends keyof EngineEventMap = keyof EngineEventMap> = (
  payload: EngineEventMap[K],
) => void;

/**
 * Tiny typed emitter, dependency-free, suitable for engine and tests.
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
    return () => set!.delete(listener as EngineEventListener);
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
