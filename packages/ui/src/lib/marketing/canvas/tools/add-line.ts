import { Line, type Canvas } from 'fabric';

export function addLine(canvas: Canvas) {
	const line = new Line([50, 100, 250, 100], {
		stroke: '#64748b',
		strokeWidth: 2,
	});
	canvas.add(line);
	canvas.setActiveObject(line);
	canvas.renderAll();
	return line;
}
