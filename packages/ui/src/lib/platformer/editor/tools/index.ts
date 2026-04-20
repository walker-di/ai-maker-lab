import type { EditorOperation, EditorToolKind } from '../operations.js';
import type { MapEditorModel } from '../map-editor.svelte.ts';
import { brushTool } from './brush.js';
import { eraserTool } from './eraser.js';
import { fillTool } from './fill.js';
import { rectangleTool } from './rectangle.js';
import { panTool } from './pan.js';
import { entityTool } from './entity-place.js';
import { spawnTool } from './spawn.js';
import { goalTool } from './goal.js';

export interface ToolPointerPayload {
  col: number;
  row: number;
  /** Ctrl/Cmd — rectangle paints empty tiles when true. */
  modifier: boolean;
  clientX: number;
  clientY: number;
}

export interface EditorTool {
  readonly kind: EditorToolKind;
  onPointerDown(model: MapEditorModel, evt: ToolPointerPayload): void;
  onPointerDrag?(model: MapEditorModel, evt: ToolPointerPayload): void;
  onPointerUp?(model: MapEditorModel, evt: ToolPointerPayload): void;
  preview?(model: MapEditorModel, evt: ToolPointerPayload): EditorOperation | null;
}

export const TOOL_REGISTRY: Record<EditorToolKind, EditorTool> = {
  brush: brushTool,
  fill: fillTool,
  rectangle: rectangleTool,
  eraser: eraserTool,
  pan: panTool,
  entity: entityTool,
  spawn: spawnTool,
  goal: goalTool,
};

export function getTool(kind: EditorToolKind): EditorTool {
  return TOOL_REGISTRY[kind];
}
