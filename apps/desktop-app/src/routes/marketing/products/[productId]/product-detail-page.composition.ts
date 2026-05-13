import { createMarketingTransport } from '$lib/adapters/marketing/create-marketing-transport.js';
import { createProductDetailPageModel } from './product-detail-page.svelte.js';

export function createProductDetailPage(productId: string) {
	const model = createProductDetailPageModel({ productId, transport: createMarketingTransport() });
	void model.loadInitial();
	return model;
}
