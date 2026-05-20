import type { MarketingTransport } from '$lib/adapters/marketing/create-marketing-transport.js';
import type {
	CreateCustomerJourneyMapDto,
	UpdateCustomerJourneyMapDto,
} from '$lib/adapters/marketing/MarketingTransport.js';
import type { CustomerJourneyMap, Product } from 'ui/source';
import { toUiCustomerJourneyMap, toUiProduct } from '../marketing-page-mappers.js';

interface CreateCustomerJourneyMapsPageModelInput {
	transport: MarketingTransport;
}

export function createCustomerJourneyMapsPageModel({
	transport,
}: CreateCustomerJourneyMapsPageModelInput) {
	let products: Product[] = [];
	let journeyMaps: CustomerJourneyMap[] = [];
	let selectedJourneyMap: CustomerJourneyMap | undefined;
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
		const [loadedProducts, loadedJourneyMaps] = await Promise.all([
			transport.catalog.listProducts(),
			transport.catalog.listCustomerJourneyMaps(),
		]);
		products = loadedProducts.map(toUiProduct);
		journeyMaps = loadedJourneyMaps.map(toUiCustomerJourneyMap);
	}

	return {
		get products() {
			return products;
		},
		get journeyMaps() {
			return journeyMaps;
		},
		get selectedJourneyMap() {
			return selectedJourneyMap;
		},
		get isFormOpen() {
			return isFormOpen;
		},
		get isLoading() {
			return isLoading;
		},
		get hasLoaded() {
			return hasLoaded;
		},
		get hasJourneyMaps() {
			return journeyMaps.length > 0;
		},
		get errorMessage() {
			return errorMessage;
		},

		async loadInitial() {
			await apply(refresh);
		},

		openCreateForm() {
			selectedJourneyMap = undefined;
			isFormOpen = true;
		},

		openEditForm(journeyMap: CustomerJourneyMap) {
			selectedJourneyMap = journeyMap;
			isFormOpen = true;
		},

		closeForm() {
			selectedJourneyMap = undefined;
			isFormOpen = false;
		},

		async saveJourneyMap(data: CreateCustomerJourneyMapDto | UpdateCustomerJourneyMapDto) {
			await apply(async () => {
				if (selectedJourneyMap) {
					await transport.catalog.updateCustomerJourneyMap(
						selectedJourneyMap.id,
						data as UpdateCustomerJourneyMapDto,
					);
				} else {
					await transport.catalog.createCustomerJourneyMap(data as CreateCustomerJourneyMapDto);
				}
				await refresh();
				selectedJourneyMap = undefined;
				isFormOpen = false;
			});
		},

		async deleteJourneyMap(id: string) {
			await apply(async () => {
				await transport.catalog.deleteCustomerJourneyMap(id);
				await refresh();
			});
		},
	};
}
