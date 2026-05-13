import { goto } from '$app/navigation';

export const marketingNav = {
	toProducts: () => goto('/marketing/products'),
	toProduct: (id: string) => goto(`/marketing/products/${id}`),
	toNewProduct: () => goto('/marketing/products/new'),
	toEditProduct: (id: string) => goto(`/marketing/products/${id}/edit`),
	toPersona: (productId: string, personaId: string) =>
		goto(`/marketing/products/${productId}/personas/${personaId}`),
	toCreative: (productId: string, personaId: string, creativeId: string) =>
		goto(`/marketing/products/${productId}/personas/${personaId}/creatives/${creativeId}`),
	toStory: (
		productId: string,
		personaId: string,
		creativeId: string,
		storyId: string,
	) =>
		goto(
			`/marketing/products/${productId}/personas/${personaId}/creatives/${creativeId}/stories/${storyId}`,
		),
	toCampaigns: () => goto('/marketing/campaigns'),
	toStrategies: () => goto('/marketing/strategies'),
	toSettings: () => goto('/marketing/settings'),
};
