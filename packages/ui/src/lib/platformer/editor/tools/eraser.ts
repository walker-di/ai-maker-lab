import type { EditorTool } from './index.js';

export const eraserTool: EditorTool = {
  kind: 'eraser',
  onPointerDown(model, evt) {
    model.beginStroke();
    model.applyOperation({ type: 'eraseTile', col: evt.col, row: evt.row });
  },
  onPointerDrag(model, evt) {
    model.applyOperation({ type: 'eraseTile', col: evt.col, row: evt.row });
  },
  preview(model, evt) {
    return { type: 'eraseTile', col: evt.col, row: evt.row };
  },
};
