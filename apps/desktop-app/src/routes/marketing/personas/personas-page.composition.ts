import { createMarketingTransport } from '$lib/adapters/marketing/create-marketing-transport.js';
import { createPersonasPageModel } from './personas-page.svelte.js';

export function createPersonasPage() {
	const model = createPersonasPageModel({ transport: createMarketingTransport() });
	void model.loadInitial();
	return model;
}
