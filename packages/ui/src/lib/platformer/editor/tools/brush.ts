import type { EditorTool } from './index.js';

export const brushTool: EditorTool = {
  kind: 'brush',
  onPointerDown(model, evt) {
    model.beginStroke();
    model.applyOperation({ type: 'paintTile', col: evt.col, row: evt.row, kind: model.selectedTile });
  },
  onPointerDrag(model, evt) {
    model.applyOperation({ type: 'paintTile', col: evt.col, row: evt.row, kind: model.selectedTile });
  },
  preview(model, evt) {
    return { type: 'paintTile', col: evt.col, row: evt.row, kind: model.selectedTile };
  },
};
