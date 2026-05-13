import { createMarketingTransport } from '$lib/adapters/marketing/create-marketing-transport.js';
import { createEditTemplatePageModel } from './canvas-template-edit-page.svelte.js';

export function createEditTemplatePage(id: string) {
	const model = createEditTemplatePageModel({ transport: createMarketingTransport() });
	void model.load(id);
	return model;
}
