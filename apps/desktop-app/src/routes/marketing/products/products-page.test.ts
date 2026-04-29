import { describe, expect, test, vi } from 'vitest';
import { createProductsPageModel } from './products-page.svelte';
import type { MarketingTransport } from '$lib/adapters/marketing/create-marketing-transport';
import type { Product, CreateProductDto, UpdateProductDto } from '$lib/adapters/marketing/MarketingTransport';

function makeProduct(id: string, name: string): Product {
	const now = '2026-01-01T00:00:00.000Z';
	return {
		id,
		name,
		description: `${name} description`,
		targetAudience: 'teams',
		features: [],
		benefits: [],
		imageUrl: undefined,
		createdAt: now,
		updatedAt: now,
	};
}

function createTransportStub(products: Product[] = [makeProduct('p-1', 'Starter')]) {
	const state = { products: [...products] };

	const catalog = {
		listProducts: vi.fn(async () => [...state.products]),
		createProduct: vi.fn(async (data: CreateProductDto) => {
			const created = makeProduct(`p-${state.products.length + 1}`, data.name);
			state.products.push(created);
			return created;
		}),
		updateProduct: vi.fn(async (id: string, data: UpdateProductDto) => {
			const index = state.products.findIndex((product) => product.id === id);
			if (index === -1) throw new Error('Product not found');
			state.products[index] = { ...state.products[index], ...data, updatedAt: '2026-01-02T00:00:00.000Z' };
			return state.products[index];
		}),
		deleteProduct: vi.fn(async (id: string) => {
			state.products = state.products.filter((product) => product.id !== id);
		}),
	};

	const transport = {
		catalog,
	} as unknown as MarketingTransport;

	return { state, catalog, transport };
}

describe('products page model', () => {
	test('loadInitial() populates products and sets hasLoaded', async () => {
		const { transport } = createTransportStub([makeProduct('p-1', 'Starter'), makeProduct('p-2', 'Pro')]);
		const model = createProductsPageModel({ transport });

		await model.loadInitial();

		expect(model.products.map((product) => product.name)).toEqual(['Starter', 'Pro']);
		expect(model.hasLoaded).toBe(true);
	});

	test('openCreateForm() opens a new product form', () => {
		const { transport } = createTransportStub();
		const model = createProductsPageModel({ transport });

		model.openCreateForm();

		expect(model.isFormOpen).toBe(true);
		expect(model.selectedProduct).toBeUndefined();
	});

	test('saveProduct(dto) creates when no product is selected and refreshes list', async () => {
		const { catalog, transport } = createTransportStub([makeProduct('p-1', 'Starter')]);
		const model = createProductsPageModel({ transport });
		await model.loadInitial();
		const listCallsBeforeSave = catalog.listProducts.mock.calls.length;

		await model.saveProduct({ name: 'Enterprise', features: [], benefits: [] });

		expect(catalog.createProduct).toHaveBeenCalledWith({ name: 'Enterprise', features: [], benefits: [] });
		expect(catalog.updateProduct).not.toHaveBeenCalled();
		expect(catalog.listProducts).toHaveBeenCalledTimes(listCallsBeforeSave + 1);
		expect(model.products.map((product) => product.name)).toContain('Enterprise');
	});

	test('saveProduct(dto) updates when a product is selected for edit', async () => {
		const existing = makeProduct('p-1', 'Starter');
		const { catalog, transport } = createTransportStub([existing]);
		const model = createProductsPageModel({ transport });
		await model.loadInitial();
		model.openEditForm(model.products[0]!);

		await model.saveProduct({ name: 'Starter Plus' });

		expect(catalog.updateProduct).toHaveBeenCalledWith('p-1', { name: 'Starter Plus' });
		expect(catalog.createProduct).not.toHaveBeenCalled();
		expect(model.products[0]?.name).toBe('Starter Plus');
	});

	test('deleteProduct(id) calls transport delete and refreshes list', async () => {
		const { catalog, transport } = createTransportStub([makeProduct('p-1', 'Starter'), makeProduct('p-2', 'Pro')]);
		const model = createProductsPageModel({ transport });
		await model.loadInitial();
		const listCallsBeforeDelete = catalog.listProducts.mock.calls.length;

		await model.deleteProduct('p-1');

		expect(catalog.deleteProduct).toHaveBeenCalledWith('p-1');
		expect(catalog.listProducts).toHaveBeenCalledTimes(listCallsBeforeDelete + 1);
		expect(model.products.map((product) => product.id)).toEqual(['p-2']);
	});

	test('loadInitial() transport error sets error state', async () => {
		const { catalog, transport } = createTransportStub();
		catalog.listProducts.mockImplementationOnce(async () => {
			throw new Error('catalog unavailable');
		});
		const model = createProductsPageModel({ transport });

		await model.loadInitial();

		expect(model.errorMessage).toBe('catalog unavailable');
		expect(model.hasLoaded).toBe(true);
		expect(model.products).toHaveLength(0);
	});

	test('closeForm() clears form state', async () => {
		const { transport } = createTransportStub();
		const model = createProductsPageModel({ transport });
		await model.loadInitial();
		model.openEditForm(model.products[0]!);

		model.closeForm();

		expect(model.isFormOpen).toBe(false);
		expect(model.selectedProduct).toBeUndefined();
	});
});
