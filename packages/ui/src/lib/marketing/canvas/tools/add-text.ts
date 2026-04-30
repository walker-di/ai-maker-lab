import { IText, type Canvas } from 'fabric';

export function addText(canvas: Canvas, text = 'Text') {
	const textObj = new IText(text, {
		left: 100,
		top: 100,
		fontSize: 24,
		fill: '#1e293b',
		fontFamily: 'Inter, sans-serif',
	});
	canvas.add(textObj);
	canvas.setActiveObject(textObj);
	canvas.renderAll();
	return textObj;
}
