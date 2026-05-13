import { type Canvas, Point } from 'fabric';

export function createCanvasZoomPan(canvas: Canvas) {
	const MIN_ZOOM = 0.1;
	const MAX_ZOOM = 5;

	let zoomLevel = $state(1);
	let isPanning = $state(false);

	let isDragging = false;
	let lastPosX = 0;
	let lastPosY = 0;

	function init() {
		canvas.on('mouse:wheel', handleWheel);
		canvas.on('mouse:down', handleMouseDown);
		canvas.on('mouse:move', handleMouseMove);
		canvas.on('mouse:up', () => { isDragging = false; });
	}

	function handleWheel(opt: any) {
		const e = opt.e as WheelEvent;
		e.preventDefault();
		e.stopPropagation();

		const delta = e.deltaY;
		let zoom = canvas.getZoom() * (0.999 ** delta);
		zoom = Math.min(Math.max(zoom, MIN_ZOOM), MAX_ZOOM);

		canvas.zoomToPoint(new Point(e.offsetX, e.offsetY), zoom);
		zoomLevel = zoom;
		canvas.requestRenderAll();
	}

	function handleMouseDown(opt: any) {
		if (!isPanning) return;
		const e = opt.e as MouseEvent;
		isDragging = true;
		lastPosX = e.clientX;
		lastPosY = e.clientY;
		canvas.defaultCursor = 'grabbing';
	}

	function handleMouseMove(opt: any) {
		if (!isPanning || !isDragging) return;
		const e = opt.e as MouseEvent;
		const vpt = canvas.viewportTransform;
		if (!vpt) return;

		vpt[4] += e.clientX - lastPosX;
		vpt[5] += e.clientY - lastPosY;
		lastPosX = e.clientX;
		lastPosY = e.clientY;

		canvas.setViewportTransform(vpt);
		canvas.requestRenderAll();
	}

	function zoomIn() {
		const zoom = Math.min(canvas.getZoom() * 1.2, MAX_ZOOM);
		const center = canvas.getCenterPoint();
		canvas.zoomToPoint(new Point(center.x, center.y), zoom);
		zoomLevel = zoom;
		canvas.requestRenderAll();
	}

	function zoomOut() {
		const zoom = Math.max(canvas.getZoom() / 1.2, MIN_ZOOM);
		const center = canvas.getCenterPoint();
		canvas.zoomToPoint(new Point(center.x, center.y), zoom);
		zoomLevel = zoom;
		canvas.requestRenderAll();
	}

	function resetZoom() {
		canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
		zoomLevel = 1;
		canvas.requestRenderAll();
	}

	function setZoom(level: number) {
		const zoom = Math.min(Math.max(level, MIN_ZOOM), MAX_ZOOM);
		const center = canvas.getCenterPoint();
		canvas.zoomToPoint(new Point(center.x, center.y), zoom);
		zoomLevel = zoom;
		canvas.requestRenderAll();
	}

	function togglePan() {
		isPanning = !isPanning;
		if (isPanning) {
			canvas.selection = false;
			canvas.defaultCursor = 'grab';
			canvas.discardActiveObject();
			canvas.requestRenderAll();
		} else {
			canvas.selection = true;
			canvas.defaultCursor = 'default';
			canvas.requestRenderAll();
		}
	}

	return {
		get zoomLevel() { return zoomLevel; },
		get isPanning() { return isPanning; },
		init,
		zoomIn,
		zoomOut,
		resetZoom,
		setZoom,
		togglePan,
	};
}

export type CanvasZoomPan = ReturnType<typeof createCanvasZoomPan>;
