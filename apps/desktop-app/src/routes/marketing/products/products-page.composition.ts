import { createMarketingTransport } from '$lib/adapters/marketing/create-marketing-transport.js';
import { createProductsPageModel } from './products-page.svelte.js';

export function createProductsPage() {
	const model = createProductsPageModel({ transport: createMarketingTransport() });
	void model.loadInitial();
	return model;
}
