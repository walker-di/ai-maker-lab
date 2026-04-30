<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { createCanvasService } from './canvas-service.svelte.js';
	import { createCanvasHistory } from './canvas-history.svelte.js';
	import { createCanvasZoomPan } from './canvas-zoom-pan.svelte.js';
	import { addRectangle } from './tools/add-rectangle.js';
	import { addCircle } from './tools/add-circle.js';
	import { addText } from './tools/add-text.js';
	import { addImage } from './tools/add-image.js';
	import { addLine } from './tools/add-line.js';
	import type { CanvasService } from './canvas-service.svelte.js';
	import type { CanvasHistory } from './canvas-history.svelte.js';
	import type { CanvasZoomPan } from './canvas-zoom-pan.svelte.js';

	interface Props {
		canvasData?: string;
		width?: number;
		height?: number;
		readonly?: boolean;
		onCanvasChange?: (json: string) => void;
	}

	let {
		canvasData,
		width = 800,
		height = 600,
		readonly: readonlyMode = false,
		onCanvasChange,
	}: Props = $props();

	let canvasEl: HTMLCanvasElement;
	let service: CanvasService | null = null;
	let history: CanvasHistory | null = null;
	let zoomPan: CanvasZoomPan | null = null;

	function emitChange() {
		if (!service || readonlyMode) return;
		onCanvasChange?.(service.toJSON());
	}

	function setupChangeListeners() {
		const canvas = service?.getCanvas();
		if (!canvas || readonlyMode) return;
		canvas.on('object:added', () => { history?.push(); emitChange(); });
		canvas.on('object:modified', () => { history?.push(); emitChange(); });
		canvas.on('object:removed', () => { history?.push(); emitChange(); });
	}

	function handleKeydown(e: KeyboardEvent) {
		if (readonlyMode) return;
		if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
			e.preventDefault();
			history?.undo();
			emitChange();
		}
		if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
			e.preventDefault();
			history?.redo();
			emitChange();
		}
		if (e.key === 'Delete' || e.key === 'Backspace') {
			const canvas = service?.getCanvas();
			if (canvas?.getActiveObject()) {
				e.preventDefault();
				service?.deleteSelected();
			}
		}
	}

	onMount(async () => {
		service = createCanvasService(canvasEl, { width, height });
		service.init();

		const canvas = service.getCanvas()!;
		history = createCanvasHistory(canvas);
		zoomPan = createCanvasZoomPan(canvas);
		zoomPan.init();

		if (canvasData) {
			await service.loadFromJSON(canvasData);
		}

		if (readonlyMode) {
			canvas.selection = false;
			canvas.defaultCursor = 'default';
			canvas.getObjects().forEach((obj) => { obj.selectable = false; obj.evented = false; });
		}

		setupChangeListeners();
		history.push();
	});

	onDestroy(() => {
		service?.destroy();
	});

	export function getCurrentCanvasJson(): string {
		return service?.toJSON() ?? '{}';
	}

	export function getCanvasImageDataUrl(format: 'png' | 'jpeg' = 'png'): string {
		return service?.toDataURL(format) ?? '';
	}

	export function resizeCanvas(w: number, h: number) {
		service?.resize(w, h);
	}

	export function doAddRectangle() {
		const canvas = service?.getCanvas();
		if (canvas) addRectangle(canvas);
	}

	export function doAddCircle() {
		const canvas = service?.getCanvas();
		if (canvas) addCircle(canvas);
	}

	export function doAddText(text?: string) {
		const canvas = service?.getCanvas();
		if (canvas) addText(canvas, text);
	}

	export function doAddImage(url: string) {
		const canvas = service?.getCanvas();
		if (canvas) return addImage(canvas, url);
	}

	export function doAddLine() {
		const canvas = service?.getCanvas();
		if (canvas) addLine(canvas);
	}

	export function doDeleteSelected() {
		service?.deleteSelected();
	}

	export function doClearCanvas() {
		service?.clearCanvas();
	}

	export function doUndo() {
		history?.undo();
		emitChange();
	}

	export function doRedo() {
		history?.redo();
		emitChange();
	}

	export function getHistory() { return history; }
	export function getZoomPan() { return zoomPan; }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="canvas-editor-container relative overflow-hidden rounded-md border bg-muted/30">
	<canvas bind:this={canvasEl}></canvas>
</div>

<style>
	.canvas-editor-container :global(canvas) {
		display: block;
	}
	.canvas-editor-container :global(.canvas-container) {
		margin: 0 auto;
	}
</style>
