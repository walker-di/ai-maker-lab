import { Rect, type Canvas } from 'fabric';

export function addRectangle(canvas: Canvas) {
	const rect = new Rect({
		left: 100,
		top: 100,
		width: 200,
		height: 150,
		fill: '#e2e8f0',
		stroke: '#64748b',
		strokeWidth: 1,
		rx: 4,
		ry: 4,
	});
	canvas.add(rect);
	canvas.setActiveObject(rect);
	canvas.renderAll();
	return rect;
}
