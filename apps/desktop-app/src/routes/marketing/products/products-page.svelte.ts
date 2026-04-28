import type { MarketingTransport } from '$lib/adapters/marketing/create-marketing-transport.js';
import type { CreateProductDto, UpdateProductDto } from '$lib/adapters/marketing/MarketingTransport.js';
import type { Product } from 'ui/source';
import { toUiProduct } from '../marketing-page-mappers.js';

interface CreateProductsPageModelInput {
	transport: MarketingTransport;
}

export function createProductsPageModel({ transport }: CreateProductsPageModelInput) {
	let products = $state<Product[]>([]);
	let selectedProduct = $state<Product | undefined>();
	let isFormOpen = $state(false);
	let isLoading = $state(false);
	let hasLoaded = $state(false);
	let errorMessage = $state<string | null>(null);

	const hasProducts = $derived(products.length > 0);

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
		const loaded = await transport.catalog.listProducts();
		products = loaded.map(toUiProduct);
	}

	return {
		get products() { return products; },
		get selectedProduct() { return selectedProduct; },
		get isFormOpen() { return isFormOpen; },
		get isLoading() { return isLoading; },
		get hasLoaded() { return hasLoaded; },
		get hasProducts() { return hasProducts; },
		get errorMessage() { return errorMessage; },

		async loadInitial() {
			await apply(refresh);
		},

		openCreateForm() {
			selectedProduct = undefined;
			isFormOpen = true;
		},

		openEditForm(product: Product) {
			selectedProduct = product;
			isFormOpen = true;
		},

		closeForm() {
			isFormOpen = false;
			selectedProduct = undefined;
		},

		async saveProduct(data: CreateProductDto | UpdateProductDto) {
			await apply(async () => {
				if (selectedProduct) {
					await transport.catalog.updateProduct(selectedProduct.id, data as UpdateProductDto);
				} else {
					await transport.catalog.createProduct(data as CreateProductDto);
				}
				await refresh();
				isFormOpen = false;
				selectedProduct = undefined;
			});
		},

		async deleteProduct(id: string) {
			await apply(async () => {
				await transport.catalog.deleteProduct(id);
				await refresh();
			});
		},
	};
}
