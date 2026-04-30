import { Canvas, Rect, type FabricObject } from 'fabric';

export interface CanvasServiceOptions {
	width?: number;
	height?: number;
	backgroundColor?: string;
}

export interface CanvasServiceState {
	readonly isReady: boolean;
	readonly activeObject: FabricObject | null;
	readonly objectCount: number;
}

export function createCanvasService(canvasEl: HTMLCanvasElement, options: CanvasServiceOptions = {}) {
	const width = options.width ?? 800;
	const height = options.height ?? 600;
	const backgroundColor = options.backgroundColor ?? '#ffffff';

	let isReady = $state(false);
	let activeObject = $state<FabricObject | null>(null);
	let objectCount = $state(0);
	let canvas: Canvas | null = null;

	function init() {
		canvas = new Canvas(canvasEl, {
			width,
			height,
			backgroundColor,
			selection: true,
			preserveObjectStacking: true,
			uniformScaling: false,
			centeredRotation: true,
			renderOnAddRemove: true,
		});

		canvas.clipPath = new Rect({
			left: 0,
			top: 0,
			width,
			height,
			absolutePositioned: true,
		});

		canvas.on('selection:created', updateActiveObject);
		canvas.on('selection:updated', updateActiveObject);
		canvas.on('selection:cleared', () => { activeObject = null; });
		canvas.on('object:added', updateObjectCount);
		canvas.on('object:removed', updateObjectCount);

		isReady = true;
		canvas.renderAll();
	}

	function updateActiveObject() {
		activeObject = canvas?.getActiveObject() ?? null;
	}

	function updateObjectCount() {
		objectCount = canvas?.getObjects().length ?? 0;
	}

	function destroy() {
		if (canvas) {
			canvas.dispose();
			canvas = null;
			isReady = false;
			activeObject = null;
			objectCount = 0;
		}
	}

	function resize(w: number, h: number) {
		if (!canvas) return;
		canvas.setDimensions({ width: w, height: h });
		canvas.clipPath = new Rect({
			left: 0, top: 0, width: w, height: h, absolutePositioned: true,
		});
		canvas.renderAll();
	}

	function addObject(obj: FabricObject) {
		if (!canvas) return;
		canvas.add(obj);
		canvas.setActiveObject(obj);
		canvas.renderAll();
	}

	function deleteSelected() {
		if (!canvas) return;
		const active = canvas.getActiveObjects();
		if (active.length === 0) return;
		active.forEach((obj) => canvas!.remove(obj));
		canvas.discardActiveObject();
		canvas.renderAll();
	}

	function clearCanvas() {
		if (!canvas) return;
		canvas.clear();
		canvas.backgroundColor = backgroundColor;
		canvas.renderAll();
	}

	function toJSON(): string {
		if (!canvas) return '{}';
		return JSON.stringify(canvas.toJSON());
	}

	async function loadFromJSON(json: string) {
		if (!canvas) return;
		await canvas.loadFromJSON(json);
		canvas.renderAll();
	}

	function toDataURL(format: 'png' | 'jpeg' = 'png', quality = 1): string {
		if (!canvas) return '';
		return canvas.toDataURL({ format, quality, multiplier: 1 });
	}

	function getCanvas(): Canvas | null {
		return canvas;
	}

	return {
		get isReady() { return isReady; },
		get activeObject() { return activeObject; },
		get objectCount() { return objectCount; },
		init,
		destroy,
		resize,
		addObject,
		deleteSelected,
		clearCanvas,
		toJSON,
		loadFromJSON,
		toDataURL,
		getCanvas,
	};
}

export type CanvasService = ReturnType<typeof createCanvasService>;
