import type { MarketingTransport } from '$lib/adapters/marketing/create-marketing-transport.js';
import type { CreatePersonaDto, UpdatePersonaDto } from '$lib/adapters/marketing/MarketingTransport.js';
import type { Persona, Product } from 'ui/source';
import { toUiPersona, toUiProduct } from '../../marketing-page-mappers.js';

interface CreateProductDetailPageModelInput {
	productId: string;
	transport: MarketingTransport;
}

export function createProductDetailPageModel({ productId, transport }: CreateProductDetailPageModelInput) {
	let product = $state<Product | null>(null);
	let personas = $state<Persona[]>([]);
	let selectedPersona = $state<Persona | undefined>();
	let isPersonaFormOpen = $state(false);
	let isLoading = $state(false);
	let hasLoaded = $state(false);
	let errorMessage = $state<string | null>(null);

	const hasPersonas = $derived(personas.length > 0);

	async function apply(action: () => Promise<void>) {
		try {
			errorMessage = null;
			isLoading = true;
			await action();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Marketing request failed.';
			console.error(error);
		} finally {
			isLoading = false;
			hasLoaded = true;
		}
	}

	async function refresh() {
		const [loadedProduct, loadedPersonas] = await Promise.all([
			transport.catalog.getProduct(productId),
			transport.catalog.listPersonas(productId),
		]);
		product = toUiProduct(loadedProduct);
		personas = loadedPersonas.map(toUiPersona);
	}

	return {
		get product() { return product; },
		get productsForForm() { return product ? [product] : []; },
		get personas() { return personas; },
		get selectedPersona() { return selectedPersona; },
		get isPersonaFormOpen() { return isPersonaFormOpen; },
		get isLoading() { return isLoading; },
		get hasLoaded() { return hasLoaded; },
		get hasPersonas() { return hasPersonas; },
		get errorMessage() { return errorMessage; },

		async loadInitial() {
			await apply(refresh);
		},

		openCreatePersonaForm() {
			selectedPersona = undefined;
			isPersonaFormOpen = true;
		},

		openEditPersonaForm(persona: Persona) {
			selectedPersona = persona;
			isPersonaFormOpen = true;
		},

		closePersonaForm() {
			isPersonaFormOpen = false;
			selectedPersona = undefined;
		},

		async savePersona(data: CreatePersonaDto | UpdatePersonaDto) {
			await apply(async () => {
				const input = { ...data, productId };
				if (selectedPersona) {
					await transport.catalog.updatePersona(selectedPersona.id, input as UpdatePersonaDto);
				} else {
					await transport.catalog.createPersona(input as CreatePersonaDto);
				}
				await refresh();
				isPersonaFormOpen = false;
				selectedPersona = undefined;
			});
		},

		async deletePersona(id: string) {
			await apply(async () => {
				await transport.catalog.deletePersona(id);
				await refresh();
			});
		},

		async generatePersonas(count = 3) {
			await apply(async () => {
				await transport.ai.generatePersonas(productId, count);
				await refresh();
			});
		},
	};
}
