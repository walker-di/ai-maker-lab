import type { EditorTool, ToolPointerPayload } from './index.js';

export const panTool: EditorTool = {
  kind: 'pan',
  onPointerDown(model, evt) {
    model.markPanDragStart(evt.clientX, evt.clientY);
  },
  onPointerDrag(model, evt) {
    model.panDragTo(evt.clientX, evt.clientY);
  },
  onPointerUp(model, _evt: ToolPointerPayload) {
    model.endPanDrag();
  },
};
