import { createMarketingTransport } from '$lib/adapters/marketing/create-marketing-transport.js';
import { createCanvasTemplatesPageModel } from './canvas-templates-page.svelte.js';

export function createCanvasTemplatesPage() {
	const model = createCanvasTemplatesPageModel({ transport: createMarketingTransport() });
	void model.loadInitial();
	return model;
}
