import type { TechKind, TilePos } from '../types.js';
import type { RtsMissionState } from './mission.js';
import type { RtsCombatSummary } from './combat-telemetry.js';

export type EngineEventMap = {
  unitCreated: { entity: number; factionId: string; kind: string };
  unitKilled: { entity: number; factionId: string; killerFactionId?: string };
  buildingPlaced: { entity: number; factionId: string; kind: string };
  buildingDestroyed: { entity: number; factionId: string };
  resourceChanged: { factionId: string; mineral: number; gas: number };
  selectionChanged: { entityIds: number[] };
  productionStarted: { factionId: string; kind: string };
  productionCanceled: { factionId: string; kind: string; producerId: number };
  productionCompleted: { factionId: string; kind: string; entity?: number };
  researchStarted: { factionId: string; kind: TechKind; researcherId: number };
  researchCanceled: { factionId: string; kind: TechKind; researcherId: number };
  researchCompleted: { factionId: string; kind: TechKind };
  squadLaunched: {
    factionId: string;
    size: number;
    waveIndex: number;
    launchedAtMs?: number;
    cadenceMs?: number;
    targetTile?: TilePos;
  };
  missionUpdated: { state: RtsMissionState };
  combatAlert: {
    tile: TilePos;
    factionId?: string;
    kind: 'impact' | 'critical';
    severity: 'warning' | 'danger';
    /** Entity that fired the projectile, if known. */
    sourceEntityId?: number;
    /** Entity that was struck, if known. */
    targetEntityId?: number;
    /** Sector key ("col:row" divided by sectorSize) for spatial bucketing. */
    sectorKey?: string;
  };
  /**
   * Fired when the active-skirmish set or any sector pressure level changes.
   * The route can subscribe once and bind the summary directly to the HUD.
   */
  combatSummaryUpdated: { summary: RtsCombatSummary };
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
