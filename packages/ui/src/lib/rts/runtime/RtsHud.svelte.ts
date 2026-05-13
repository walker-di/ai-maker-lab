import type { BuildingKind, TechKind, UnitKind } from '../types.js';

export type RtsHudOrderKind = 'attackMove' | 'patrol' | 'repair' | 'rally';
export type RtsHudUtilityKind = 'stop' | 'hold' | 'army';
export type RtsHudResearchKind = TechKind;

export interface RtsHudCombatReadout {
  tone: 'calm' | 'warning' | 'danger' | 'success' | 'failure';
  statusLabel: string;
  headline: string;
  detail: string;
  contactLabel: string;
  enemyForceLabel: string;
  directionLabel: string;
  directionDetail: string;
  timerLabel: string;
  timerValue: string;
}

export interface RtsHudIntentPreview {
  label: string;
  detail: string;
}

export interface RtsHudActionMeta<K extends string> {
  kind: K;
  label: string;
  hotkey: string;
  detail?: string;
}

export const RTS_HUD_TRAIN_ACTIONS: ReadonlyArray<RtsHudActionMeta<UnitKind>> = [
  { kind: 'worker', label: 'Worker', hotkey: 'Q', detail: 'Economy' },
  { kind: 'rifleman', label: 'Rifleman', hotkey: 'W', detail: 'Frontline' },
  { kind: 'scout', label: 'Scout', hotkey: 'C', detail: 'Recon' },
  { kind: 'rocket', label: 'Rocket', hotkey: 'V', detail: 'Siege' },
];

export const RTS_HUD_BUILD_ACTIONS: ReadonlyArray<RtsHudActionMeta<BuildingKind>> = [
  { kind: 'depot', label: 'Depot', hotkey: 'E', detail: 'Supply' },
  { kind: 'refinery', label: 'Refinery', hotkey: 'F', detail: 'Gas' },
  { kind: 'barracks', label: 'Barracks', hotkey: '--', detail: 'Infantry' },
  { kind: 'factory', label: 'Factory', hotkey: '--', detail: 'Heavy' },
  { kind: 'turret', label: 'Turret', hotkey: 'R', detail: 'Defense' },
];

export const RTS_HUD_ORDER_ACTIONS: ReadonlyArray<RtsHudActionMeta<RtsHudOrderKind>> = [
  { kind: 'attackMove', label: 'Attack', hotkey: 'A', detail: 'Advance and fire' },
  { kind: 'patrol', label: 'Patrol', hotkey: 'P', detail: 'Cycle route' },
  { kind: 'repair', label: 'Repair', hotkey: 'T', detail: 'Worker only' },
  { kind: 'rally', label: 'Rally', hotkey: 'G', detail: 'Structures only' },
];

export const RTS_HUD_RESEARCH_ACTIONS: ReadonlyArray<RtsHudActionMeta<RtsHudResearchKind>> = [
  { kind: 'armorT1', label: 'Armor I', hotkey: 'Z', detail: 'Frontline plating' },
  { kind: 'armorT2', label: 'Armor II', hotkey: 'X', detail: 'Tier II plating' },
  { kind: 'weaponT1', label: 'Weapons I', hotkey: 'B', detail: 'Ballistics' },
  { kind: 'weaponT2', label: 'Weapons II', hotkey: 'N', detail: 'Tier II ballistics' },
  { kind: 'sightRange', label: 'Optics', hotkey: 'L', detail: 'Sensor range' },
];

export const RTS_HUD_UTILITY_ACTIONS: ReadonlyArray<RtsHudActionMeta<RtsHudUtilityKind>> = [
  { kind: 'stop', label: 'Stop', hotkey: 'S', detail: 'Clear orders' },
  { kind: 'hold', label: 'Hold', hotkey: 'H', detail: 'Stand ground' },
  { kind: 'army', label: 'Army', hotkey: 'F1', detail: 'Select combat units' },
];

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
  armedOrder: RtsHudOrderKind | null;
  activeResearchLabel: string | null;
  activeResearchProgress: number | null;
  completedResearchCount: number;
  paused: boolean;
  muted: boolean;
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
    armedOrder: null,
    activeResearchLabel: null,
    activeResearchProgress: null,
    completedResearchCount: 0,
    paused: false,
    muted: false,
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
  setArmedOrder(kind: RtsHudOrderKind | null): void { this.state.armedOrder = kind; }
  setResearch(label: string | null, progress: number | null, completedCount: number): void {
    this.state.activeResearchLabel = label;
    this.state.activeResearchProgress = progress;
    this.state.completedResearchCount = completedCount;
  }
  setPaused(paused: boolean): void { this.state.paused = paused; }
  setMuted(muted: boolean): void { this.state.muted = muted; }
  setFactionId(id: string): void { this.state.factionId = id; }
}

export function createRtsHudModel(): RtsHudModel {
  return new RtsHudModel();
}
