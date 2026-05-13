import { Circle, type Canvas } from 'fabric';

export function addCircle(canvas: Canvas) {
	const circle = new Circle({
		left: 100,
		top: 100,
		radius: 75,
		fill: '#dbeafe',
		stroke: '#3b82f6',
		strokeWidth: 1,
	});
	canvas.add(circle);
	canvas.setActiveObject(circle);
	canvas.renderAll();
	return circle;
}
