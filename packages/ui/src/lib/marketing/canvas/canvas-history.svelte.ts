import type { Canvas } from 'fabric';

export function createCanvasHistory(canvas: Canvas, maxSize = 50) {
	let undoStack: string[] = [];
	let redoStack: string[] = [];
	let processing = false;

	let canUndo = $state(false);
	let canRedo = $state(false);

	function getState(): string {
		return JSON.stringify(canvas.toJSON());
	}

	function updateFlags() {
		canUndo = undoStack.length > 0;
		canRedo = redoStack.length > 0;
	}

	function push() {
		if (processing) return;
		const state = getState();
		undoStack.push(state);
		if (undoStack.length > maxSize) {
			undoStack.shift();
		}
		redoStack = [];
		updateFlags();
	}

	async function undo() {
		if (!canUndo || processing) return;
		processing = true;
		redoStack.push(getState());
		const state = undoStack.pop()!;
		await canvas.loadFromJSON(state);
		canvas.renderAll();
		updateFlags();
		processing = false;
	}

	async function redo() {
		if (!canRedo || processing) return;
		processing = true;
		undoStack.push(getState());
		const state = redoStack.pop()!;
		await canvas.loadFromJSON(state);
		canvas.renderAll();
		updateFlags();
		processing = false;
	}

	function clear() {
		undoStack = [];
		redoStack = [];
		updateFlags();
	}

	return {
		get canUndo() { return canUndo; },
		get canRedo() { return canRedo; },
		push,
		undo,
		redo,
		clear,
	};
}

export type CanvasHistory = ReturnType<typeof createCanvasHistory>;
