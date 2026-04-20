import type { EditorTool } from './index.js';

export const goalTool: EditorTool = {
  kind: 'goal',
  onPointerDown(model, evt) {
    model.beginStroke();
    model.applyOperation({ type: 'setGoal', col: evt.col, row: evt.row, kind: model.map.goal.kind });
  },
};
