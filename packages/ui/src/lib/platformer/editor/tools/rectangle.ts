import type { EditorTool } from './index.js';

export const rectangleTool: EditorTool = {
  kind: 'rectangle',
  onPointerDown(model, evt) {
    model.setRectangleAnchor(evt.col, evt.row);
  },
  onPointerUp(model, evt) {
    const anchor = model.rectangleAnchor;
    if (!anchor) return;
    const c0 = Math.min(anchor.col, evt.col);
    const c1 = Math.max(anchor.col, evt.col);
    const r0 = Math.min(anchor.row, evt.row);
    const r1 = Math.max(anchor.row, evt.row);
    const kind = evt.modifier ? 'empty' : model.selectedTile;
    model.applyOperation({
      type: 'paintRect',
      rect: { col: c0, row: r0, cols: c1 - c0 + 1, rows: r1 - r0 + 1 },
      kind,
    });
    model.clearRectangleAnchor();
  },
  preview(model, evt) {
    const anchor = model.rectangleAnchor;
    if (!anchor) return null;
    const c0 = Math.min(anchor.col, evt.col);
    const c1 = Math.max(anchor.col, evt.col);
    const r0 = Math.min(anchor.row, evt.row);
    const r1 = Math.max(anchor.row, evt.row);
    const kind = evt.modifier ? 'empty' : model.selectedTile;
    return {
      type: 'paintRect',
      rect: { col: c0, row: r0, cols: c1 - c0 + 1, rows: r1 - r0 + 1 },
      kind,
    };
  },
};
