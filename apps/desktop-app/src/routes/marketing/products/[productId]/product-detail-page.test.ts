import { describe, expect, test, vi } from 'vitest';
import { createProductDetailPageModel } from './product-detail-page.svelte';
import type { MarketingTransport } from '$lib/adapters/marketing/create-marketing-transport';
import type { Persona, Product } from '$lib/adapters/marketing/MarketingTransport';

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

function makePersona(id: string, productId: string, name: string): Persona {
	const now = '2026-01-01T00:00:00.000Z';
	return {
		id,
		productId,
		name,
		age: 28,
		ageRange: '25-34',
		gender: 'female',
		occupation: 'PM',
		income: undefined,
		interests: [],
		painPoints: [],
		motivations: [],
		description: '',
		avatarUrl: undefined,
		createdAt: now,
		updatedAt: now,
	};
}

function createTransportStub() {
	const state = {
		product: makeProduct('p-1', 'Starter'),
		personas: [makePersona('persona-1', 'p-1', 'Alex')],
	};

	const catalog = {
		getProduct: vi.fn(async (id: string) => {
			if (id !== state.product.id) throw new Error('Product not found');
			return state.product;
		}),
		listPersonas: vi.fn(async (productId?: string) =>
			productId ? state.personas.filter((persona) => persona.productId === productId) : [...state.personas],
		),
	};

	const ai = {
		generatePersonas: vi.fn(async (productId: string, count = 3) => {
			const generated = Array.from({ length: count }, (_, index) =>
				makePersona(`generated-${index + 1}`, productId, `Generated ${index + 1}`),
			);
			state.personas = [...state.personas, ...generated];
			return generated;
		}),
	};

	const transport = {
		catalog,
		ai,
	} as unknown as MarketingTransport;

	return { state, catalog, ai, transport };
}

describe('product detail page model', () => {
	test('loadInitial() loads product/personas and sets hasLoaded', async () => {
		const { transport } = createTransportStub();
		const model = createProductDetailPageModel({ productId: 'p-1', transport });

		await model.loadInitial();

		expect(model.product?.id).toBe('p-1');
		expect(model.personas.map((persona) => persona.name)).toEqual(['Alex']);
		expect(model.hasLoaded).toBe(true);
	});

	test('loadInitial() with unknown product id sets error state', async () => {
		const { transport } = createTransportStub();
		const model = createProductDetailPageModel({ productId: 'missing', transport });

		await model.loadInitial();

		expect(model.errorMessage).toBe('Product not found');
		expect(model.product).toBeNull();
		expect(model.hasLoaded).toBe(true);
	});

	test('generatePersonas(count) calls ai transport and refreshes personas', async () => {
		const { ai, catalog, transport } = createTransportStub();
		const model = createProductDetailPageModel({ productId: 'p-1', transport });
		await model.loadInitial();
		const listCallsBeforeGenerate = catalog.listPersonas.mock.calls.length;

		await model.generatePersonas(2);

		expect(ai.generatePersonas).toHaveBeenCalledWith('p-1', 2);
		expect(catalog.listPersonas).toHaveBeenCalledTimes(listCallsBeforeGenerate + 1);
		expect(model.personas).toHaveLength(3);
	});

	test('generatePersonas(count) transport error sets error state', async () => {
		const { ai, transport } = createTransportStub();
		const model = createProductDetailPageModel({ productId: 'p-1', transport });
		await model.loadInitial();
		ai.generatePersonas.mockImplementationOnce(async () => {
			throw new Error('generation failed');
		});

		await model.generatePersonas(1);

		expect(model.errorMessage).toBe('generation failed');
		expect(model.personas).toHaveLength(1);
		expect(model.hasLoaded).toBe(true);
	});
});
