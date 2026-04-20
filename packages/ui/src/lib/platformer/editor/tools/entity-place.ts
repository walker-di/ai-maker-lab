import type { EditorTool } from './index.js';

export const entityTool: EditorTool = {
  kind: 'entity',
  onPointerDown(model, evt) {
    if (!model.selectedEntity) return;
    model.beginStroke();
    model.applyOperation({ type: 'placeEntity', col: evt.col, row: evt.row, kind: model.selectedEntity });
  },
  preview(model, evt) {
    if (!model.selectedEntity) return null;
    return { type: 'placeEntity', col: evt.col, row: evt.row, kind: model.selectedEntity };
  },
};
