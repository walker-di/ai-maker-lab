import { FabricImage, type Canvas } from 'fabric';

export async function addImage(canvas: Canvas, url: string) {
	const img = await FabricImage.fromURL(url, { crossOrigin: 'anonymous' });

	const canvasWidth = canvas.getWidth();
	const canvasHeight = canvas.getHeight();
	const scaleX = (canvasWidth * 0.5) / (img.width || 1);
	const scaleY = (canvasHeight * 0.5) / (img.height || 1);
	const scale = Math.min(scaleX, scaleY);

	img.set({
		left: 100,
		top: 100,
		scaleX: scale,
		scaleY: scale,
	});

	canvas.add(img);
	canvas.setActiveObject(img);
	canvas.renderAll();
	return img;
}
