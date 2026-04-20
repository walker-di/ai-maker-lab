import type { EditorTool } from './index.js';

export const spawnTool: EditorTool = {
  kind: 'spawn',
  onPointerDown(model, evt) {
    model.beginStroke();
    model.applyOperation({ type: 'setSpawn', col: evt.col, row: evt.row });
  },
};
