import type { EditorTool } from './index.js';

export const fillTool: EditorTool = {
  kind: 'fill',
  onPointerDown(model, evt) {
    model.beginStroke();
    model.applyOperation({ type: 'fillTile', col: evt.col, row: evt.row, kind: model.selectedTile });
  },
  preview(model, evt) {
    return { type: 'fillTile', col: evt.col, row: evt.row, kind: model.selectedTile };
  },
};
