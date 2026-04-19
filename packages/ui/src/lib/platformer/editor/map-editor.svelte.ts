import {
  applyEditorOperation,
  type EditorOperation,
  type EditorToolKind,
} from './operations.js';
import type {
  EntityKind,
  MapDefinition,
  MapMetadata,
  MapValidationResult,
  TileKind,
} from '../types.js';
import { validateMap } from './validate.js';

export interface ViewportState {
  offsetX: number;
  offsetY: number;
  zoom: number;
}

export interface PlaytestState {
  active: boolean;
  lastEditedAt: number;
}

export interface MapEditorEvents {
  requestSave?: (map: MapDefinition) => void;
  requestSaveAs?: (map: MapDefinition) => void;
  requestLoad?: (mapId: string) => void;
  requestNew?: () => void;
  requestDuplicateBuiltIn?: (builtInId: string) => void;
}

const HISTORY_BOUND = 100;

/**
 * Editor presentation model. Owns state, history, validation, tool dispatch.
 *
 * Visual layer (`MapEditorCanvas.svelte`, palettes, toolbar) binds to this
 * model and never mutates state directly.
 */
export class MapEditorModel {
  map = $state<MapDefinition>(emptyMap());
  metadata = $state<MapMetadata>({
    title: 'Untitled',
    author: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source: 'user',
  });
  selectedTool = $state<EditorToolKind>('brush');
  selectedTile = $state<TileKind>('ground');
  selectedEntity = $state<EntityKind | undefined>(undefined);
  cursor = $state<{ col: number; row: number } | null>(null);
  viewport = $state<ViewportState>({ offsetX: 0, offsetY: 0, zoom: 2 });
  validation = $state<MapValidationResult>({ ok: true, errors: [], warnings: [] });
  playtest = $state<PlaytestState>({ active: false, lastEditedAt: 0 });
  dirty = $state<boolean>(false);

  private history: MapDefinition[] = [];
  private historyIndex = -1;
  private lastBrushKey: string | null = null;
  private events: MapEditorEvents;

  constructor(events: MapEditorEvents = {}) {
    this.events = events;
    this.pushHistory();
    this.revalidate();
  }

  setMap(map: MapDefinition, metadata?: MapMetadata): void {
    this.map = map;
    if (metadata) this.metadata = metadata;
    this.history = [];
    this.historyIndex = -1;
    this.dirty = false;
    this.pushHistory();
    this.revalidate();
  }

  applyOperation(op: EditorOperation): void {
    const result = applyEditorOperation(this.map, op);
    if (!result.changed) return;
    this.map = result.map;
    if (op.type === 'paintTile' || op.type === 'eraseTile') {
      const key = `${op.col},${op.row}`;
      // Coalesce consecutive paint/erase to the same cell.
      if (this.lastBrushKey === key) {
        this.history[this.historyIndex] = clone(result.map);
      } else {
        this.lastBrushKey = key;
        this.pushHistory();
      }
    } else {
      this.lastBrushKey = null;
      this.pushHistory();
    }
    this.dirty = true;
    this.metadata = { ...this.metadata, updatedAt: new Date().toISOString() };
    this.revalidate();
  }

  beginStroke(): void { this.lastBrushKey = null; }

  undo(): void {
    if (this.historyIndex <= 0) return;
    this.historyIndex--;
    this.map = clone(this.history[this.historyIndex]!);
    this.dirty = true;
    this.lastBrushKey = null;
    this.revalidate();
  }

  redo(): void {
    if (this.historyIndex >= this.history.length - 1) return;
    this.historyIndex++;
    this.map = clone(this.history[this.historyIndex]!);
    this.dirty = true;
    this.lastBrushKey = null;
    this.revalidate();
  }

  setTool(tool: EditorToolKind): void { this.selectedTool = tool; }
  setSelectedTile(kind: TileKind): void { this.selectedTile = kind; }
  setSelectedEntity(kind: EntityKind | undefined): void { this.selectedEntity = kind; }
  setMetadata(meta: Partial<MapMetadata>): void {
    this.metadata = { ...this.metadata, ...meta, updatedAt: new Date().toISOString() };
    this.dirty = true;
  }

  revalidate(): void {
    this.validation = validateMap(this.map);
  }

  enterPlaytest(): boolean {
    if (this.validation.errors.length > 0) return false;
    this.playtest = { active: true, lastEditedAt: Date.now() };
    return true;
  }
  exitPlaytest(): void {
    this.playtest = { ...this.playtest, active: false };
  }

  serializeForPlaytest(): MapDefinition {
    return JSON.parse(JSON.stringify(this.map)) as MapDefinition;
  }

  requestSave(): void { this.events.requestSave?.(this.map); }
  requestSaveAs(): void { this.events.requestSaveAs?.(this.map); }
  requestLoad(mapId: string): void { this.events.requestLoad?.(mapId); }
  requestNew(): void { this.events.requestNew?.(); }
  requestDuplicateBuiltIn(builtInId: string): void { this.events.requestDuplicateBuiltIn?.(builtInId); }

  historyDepth(): number { return this.history.length; }
  historyCursor(): number { return this.historyIndex; }

  private pushHistory(): void {
    // Drop redo branch when a new op happens after undo.
    if (this.historyIndex >= 0 && this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    this.history.push(clone(this.map));
    if (this.history.length > HISTORY_BOUND) {
      this.history.shift();
    }
    this.historyIndex = this.history.length - 1;
  }
}

function clone(map: MapDefinition): MapDefinition {
  return JSON.parse(JSON.stringify(map)) as MapDefinition;
}

export function emptyMap(cols = 32, rows = 14, tileSize = 16): MapDefinition {
  const tiles: TileKind[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => 'empty' as TileKind),
  );
  for (let c = 0; c < cols; c++) tiles[rows - 1]![c] = 'ground';
  return {
    id: `user-${Date.now()}`,
    version: 1,
    size: { cols, rows },
    tileSize,
    scrollMode: 'horizontal',
    spawn: { col: 1, row: rows - 2 },
    goal: { col: cols - 2, row: rows - 2, kind: 'flag' },
    tiles,
    entities: [],
    background: 'sky',
    music: 'overworld',
  };
}

export function createMapEditorModel(events: MapEditorEvents = {}): MapEditorModel {
  return new MapEditorModel(events);
}
