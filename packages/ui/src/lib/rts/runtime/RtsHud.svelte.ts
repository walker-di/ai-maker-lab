/**
 * Presentation model for the RTS HUD. Tracks resources, supply, selection
 * summary and elapsed match time. Driven by the page model from engine
 * events.
 */
export interface RtsHudState {
  factionId: string;
  mineral: number;
  gas: number;
  supplyUsed: number;
  supplyCap: number;
  selectionCount: number;
  selectionLabel: string;
  elapsedMs: number;
  buildingMode: string | null;
  paused: boolean;
}

export class RtsHudModel {
  state = $state<RtsHudState>({
    factionId: 'p1',
    mineral: 0,
    gas: 0,
    supplyUsed: 0,
    supplyCap: 12,
    selectionCount: 0,
    selectionLabel: '',
    elapsedMs: 0,
    buildingMode: null,
    paused: false,
  });

  setResources(mineral: number, gas: number): void {
    this.state.mineral = mineral;
    this.state.gas = gas;
  }
  setSupply(used: number, cap: number): void {
    this.state.supplyUsed = used;
    this.state.supplyCap = cap;
  }
  setSelection(count: number, label: string): void {
    this.state.selectionCount = count;
    this.state.selectionLabel = label;
  }
  setElapsed(ms: number): void { this.state.elapsedMs = ms; }
  setBuildingMode(kind: string | null): void { this.state.buildingMode = kind; }
  setPaused(paused: boolean): void { this.state.paused = paused; }
  setFactionId(id: string): void { this.state.factionId = id; }
}

export function createRtsHudModel(): RtsHudModel {
  return new RtsHudModel();
}
