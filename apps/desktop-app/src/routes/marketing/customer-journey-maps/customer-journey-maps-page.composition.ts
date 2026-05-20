import { createMarketingTransport } from '$lib/adapters/marketing/create-marketing-transport.js';
import { createCustomerJourneyMapsPageModel } from './customer-journey-maps-page.svelte.js';

export function createCustomerJourneyMapsPage() {
	const model = createCustomerJourneyMapsPageModel({ transport: createMarketingTransport() });
	void model.loadInitial();
	return model;
}
