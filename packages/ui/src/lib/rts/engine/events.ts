export type EngineEventMap = {
  unitCreated: { entity: number; factionId: string; kind: string };
  unitKilled: { entity: number; factionId: string; killerFactionId?: string };
  buildingPlaced: { entity: number; factionId: string; kind: string };
  buildingDestroyed: { entity: number; factionId: string };
  resourceChanged: { factionId: string; mineral: number; gas: number };
  selectionChanged: { entityIds: number[] };
  productionStarted: { factionId: string; kind: string };
  productionCompleted: { factionId: string; kind: string; entity?: number };
  matchEnded: { winner: string; durationMs: number };
};

type Listener<T> = (payload: T) => void;

export class EngineEmitter {
  private readonly listeners = new Map<keyof EngineEventMap, Set<Listener<unknown>>>();

  on<K extends keyof EngineEventMap>(type: K, listener: Listener<EngineEventMap[K]>): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener as Listener<unknown>);
    return () => set!.delete(listener as Listener<unknown>);
  }

  emit<K extends keyof EngineEventMap>(type: K, payload: EngineEventMap[K]): void {
    const set = this.listeners.get(type);
    if (!set) return;
    for (const listener of set) (listener as Listener<EngineEventMap[K]>)(payload);
  }

  removeAll(): void {
    this.listeners.clear();
  }
}
