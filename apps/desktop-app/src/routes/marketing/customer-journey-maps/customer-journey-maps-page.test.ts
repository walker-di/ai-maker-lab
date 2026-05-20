import { describe, expect, test, vi } from 'vitest';
import { createCustomerJourneyMapsPageModel } from './customer-journey-maps-page.svelte';
import type { MarketingTransport } from '$lib/adapters/marketing/create-marketing-transport';
import type {
	CreateCustomerJourneyMapDto,
	CustomerJourneyMap,
	Product,
	UpdateCustomerJourneyMapDto,
} from '$lib/adapters/marketing/MarketingTransport';

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

function makeJourneyMap(id: string, productId: string, name: string): CustomerJourneyMap {
	const now = '2026-01-01T00:00:00.000Z';
	return {
		id,
		productId,
		name,
		description: '',
		scenario: '',
		goals: [],
		status: 'draft',
		tags: [],
		stages: [],
		lanes: [],
		cells: [],
		touchpoints: [],
		emotionPoints: [],
		opportunities: [],
		createdAt: now,
		updatedAt: now,
	};
}

function createTransportStub(input?: { products?: Product[]; journeyMaps?: CustomerJourneyMap[] }) {
	const state = {
		products: input?.products ? [...input.products] : [makeProduct('p-1', 'Starter')],
		journeyMaps: input?.journeyMaps ? [...input.journeyMaps] : [makeJourneyMap('cjm-1', 'p-1', 'Awareness to Expansion')],
	};

	const catalog = {
		listProducts: vi.fn(async () => [...state.products]),
		listCustomerJourneyMaps: vi.fn(async () => [...state.journeyMaps]),
		createCustomerJourneyMap: vi.fn(async (data: CreateCustomerJourneyMapDto) => {
			const created = makeJourneyMap(`cjm-${state.journeyMaps.length + 1}`, data.productId, data.name);
			state.journeyMaps.push(created);
			return created;
		}),
		updateCustomerJourneyMap: vi.fn(async (id: string, data: UpdateCustomerJourneyMapDto) => {
			const index = state.journeyMaps.findIndex((j) => j.id === id);
			if (index === -1) throw new Error('Journey map not found');
			state.journeyMaps[index] = { ...state.journeyMaps[index], ...data, updatedAt: '2026-01-02T00:00:00.000Z' };
			return state.journeyMaps[index];
		}),
		deleteCustomerJourneyMap: vi.fn(async (id: string) => {
			state.journeyMaps = state.journeyMaps.filter((j) => j.id !== id);
		}),
	};

	const transport = {
		catalog,
	} as unknown as MarketingTransport;

	return { state, catalog, transport };
}

describe('customer journey maps page model', () => {
	test('loadInitial() loads products/journeyMaps and sets hasLoaded', async () => {
		const { transport } = createTransportStub();
		const model = createCustomerJourneyMapsPageModel({ transport });

		await model.loadInitial();

		expect(model.products).toHaveLength(1);
		expect(model.journeyMaps).toHaveLength(1);
		expect(model.hasLoaded).toBe(true);
	});

	test('empty products list yields truthy no-products derived state', async () => {
		const { transport } = createTransportStub({ products: [] });
		const model = createCustomerJourneyMapsPageModel({ transport });

		await model.loadInitial();

		expect(model.products.length === 0).toBe(true);
	});

	test('saveJourneyMap(dto) creates when no journey map is selected for edit', async () => {
		const { catalog, transport } = createTransportStub();
		const model = createCustomerJourneyMapsPageModel({ transport });
		await model.loadInitial();
		const listCallsBeforeSave = catalog.listCustomerJourneyMaps.mock.calls.length;

		await model.saveJourneyMap({
			productId: 'p-1',
			name: 'Trial Journey',
			status: 'draft',
			goals: [],
			tags: [],
			stages: [],
			lanes: [],
			cells: [],
			touchpoints: [],
			emotionPoints: [],
			opportunities: [],
		});

		expect(catalog.createCustomerJourneyMap).toHaveBeenCalled();
		expect(catalog.updateCustomerJourneyMap).not.toHaveBeenCalled();
		expect(catalog.listCustomerJourneyMaps).toHaveBeenCalledTimes(listCallsBeforeSave + 1);
		expect(model.journeyMaps.map((j) => j.name)).toContain('Trial Journey');
	});

	test('saveJourneyMap(dto) updates when editing an existing journey map', async () => {
		const { catalog, transport } = createTransportStub();
		const model = createCustomerJourneyMapsPageModel({ transport });
		await model.loadInitial();
		model.openEditForm(model.journeyMaps[0]!);

		await model.saveJourneyMap({ name: 'Awareness to Expansion Updated' });

		expect(catalog.updateCustomerJourneyMap).toHaveBeenCalledWith('cjm-1', { name: 'Awareness to Expansion Updated' });
		expect(catalog.createCustomerJourneyMap).not.toHaveBeenCalled();
		expect(model.journeyMaps[0]?.name).toBe('Awareness to Expansion Updated');
	});

	test('deleteJourneyMap(id) deletes and refreshes list', async () => {
		const { catalog, transport } = createTransportStub();
		const model = createCustomerJourneyMapsPageModel({ transport });
		await model.loadInitial();
		const listCallsBeforeDelete = catalog.listCustomerJourneyMaps.mock.calls.length;

		await model.deleteJourneyMap('cjm-1');

		expect(catalog.deleteCustomerJourneyMap).toHaveBeenCalledWith('cjm-1');
		expect(catalog.listCustomerJourneyMaps).toHaveBeenCalledTimes(listCallsBeforeDelete + 1);
		expect(model.journeyMaps).toHaveLength(0);
	});

	test('loadInitial() transport error sets error state', async () => {
		const { catalog, transport } = createTransportStub();
		catalog.listProducts.mockImplementationOnce(async () => {
			throw new Error('failed loading products');
		});
		const model = createCustomerJourneyMapsPageModel({ transport });

		await model.loadInitial();

		expect(model.errorMessage).toBe('failed loading products');
		expect(model.hasLoaded).toBe(true);
	});
});
