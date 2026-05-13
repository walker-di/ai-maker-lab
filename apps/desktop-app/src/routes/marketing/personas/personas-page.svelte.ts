import type { MarketingTransport } from '$lib/adapters/marketing/create-marketing-transport.js';
import type { CreatePersonaDto, UpdatePersonaDto } from '$lib/adapters/marketing/MarketingTransport.js';
import type { Persona, Product } from 'ui/source';
import { toUiPersona, toUiProduct } from '../marketing-page-mappers.js';

interface CreatePersonasPageModelInput {
	transport: MarketingTransport;
}

export function createPersonasPageModel({ transport }: CreatePersonasPageModelInput) {
	let products: Product[] = [];
	let personas: Persona[] = [];
	let selectedPersona: Persona | undefined;
	let isFormOpen = false;
	let isLoading = false;
	let hasLoaded = false;
	let errorMessage: string | null = null;

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
		const [loadedProducts, loadedPersonas] = await Promise.all([
			transport.catalog.listProducts(),
			transport.catalog.listPersonas(),
		]);
		products = loadedProducts.map(toUiProduct);
		personas = loadedPersonas.map(toUiPersona);
	}

	return {
		get products() { return products; },
		get personas() { return personas; },
		get selectedPersona() { return selectedPersona; },
		get isFormOpen() { return isFormOpen; },
		get isLoading() { return isLoading; },
		get hasLoaded() { return hasLoaded; },
		get hasPersonas() { return personas.length > 0; },
		get errorMessage() { return errorMessage; },

		async loadInitial() { await apply(refresh); },
		openCreateForm() { selectedPersona = undefined; isFormOpen = true; },
		openEditForm(persona: Persona) { selectedPersona = persona; isFormOpen = true; },
		closeForm() { selectedPersona = undefined; isFormOpen = false; },

		async savePersona(data: CreatePersonaDto | UpdatePersonaDto) {
			await apply(async () => {
				if (selectedPersona) {
					await transport.catalog.updatePersona(selectedPersona.id, data as UpdatePersonaDto);
				} else {
					await transport.catalog.createPersona(data as CreatePersonaDto);
				}
				await refresh();
				selectedPersona = undefined;
				isFormOpen = false;
			});
		},

		async deletePersona(id: string) {
			await apply(async () => {
				await transport.catalog.deletePersona(id);
				await refresh();
			});
		},
	};
}
