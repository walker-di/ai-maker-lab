import type { MarketingTransport } from '$lib/adapters/marketing/create-marketing-transport.js';
import type { CanvasTemplate } from '$lib/adapters/marketing/MarketingTransport.js';

interface CreateCanvasTemplatesPageModelInput {
	transport: MarketingTransport;
}

export function createCanvasTemplatesPageModel({ transport }: CreateCanvasTemplatesPageModelInput) {
	let templates = $state<CanvasTemplate[]>([]);
	let isLoading = $state(false);
	let hasLoaded = $state(false);
	let errorMessage = $state<string | null>(null);

	const hasTemplates = $derived(templates.length > 0);

	async function apply(action: () => Promise<void>) {
		try {
			errorMessage = null;
			isLoading = true;
			await action();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Request failed.';
			console.error(error);
		} finally {
			isLoading = false;
			hasLoaded = true;
		}
	}

	async function refresh() {
		const loaded = await transport.catalog.listCanvasTemplates();
		templates = loaded;
	}

	return {
		get templates() { return templates; },
		get isLoading() { return isLoading; },
		get hasLoaded() { return hasLoaded; },
		get hasTemplates() { return hasTemplates; },
		get errorMessage() { return errorMessage; },

		async loadInitial() {
			await apply(refresh);
		},

		async deleteTemplate(id: string) {
			await apply(async () => {
				await transport.catalog.deleteCanvasTemplate(id);
				await refresh();
			});
		},

		async duplicateTemplate(id: string) {
			await apply(async () => {
				await transport.catalog.duplicateCanvasTemplate(id);
				await refresh();
			});
		},
	};
}
