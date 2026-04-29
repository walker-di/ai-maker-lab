import { describe, expect, test, vi } from 'vitest';
import { createPersonasPageModel } from './personas-page.svelte';
import type {
	CreatePersonaDto,
	MarketingTransport,
	Persona,
	Product,
	UpdatePersonaDto,
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

function makePersona(id: string, productId: string, name: string): Persona {
	const now = '2026-01-01T00:00:00.000Z';
	return {
		id,
		productId,
		name,
		age: 30,
		ageRange: '25-34',
		gender: 'male',
		occupation: 'Engineer',
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

function createTransportStub(input?: { products?: Product[]; personas?: Persona[] }) {
	const state = {
		products: input?.products ? [...input.products] : [makeProduct('p-1', 'Starter')],
		personas: input?.personas ? [...input.personas] : [makePersona('persona-1', 'p-1', 'Alex')],
	};

	const catalog = {
		listProducts: vi.fn(async () => [...state.products]),
		listPersonas: vi.fn(async () => [...state.personas]),
		createPersona: vi.fn(async (data: CreatePersonaDto) => {
			const created = makePersona(`persona-${state.personas.length + 1}`, data.productId, data.name);
			state.personas.push(created);
			return created;
		}),
		updatePersona: vi.fn(async (id: string, data: UpdatePersonaDto) => {
			const index = state.personas.findIndex((persona) => persona.id === id);
			if (index === -1) throw new Error('Persona not found');
			state.personas[index] = { ...state.personas[index], ...data, updatedAt: '2026-01-02T00:00:00.000Z' };
			return state.personas[index];
		}),
		deletePersona: vi.fn(async (id: string) => {
			state.personas = state.personas.filter((persona) => persona.id !== id);
		}),
	};

	const transport = {
		catalog,
	} as unknown as MarketingTransport;

	return { state, catalog, transport };
}

describe('personas page model', () => {
	test('loadInitial() loads products/personas and sets hasLoaded', async () => {
		const { transport } = createTransportStub();
		const model = createPersonasPageModel({ transport });

		await model.loadInitial();

		expect(model.products).toHaveLength(1);
		expect(model.personas).toHaveLength(1);
		expect(model.hasLoaded).toBe(true);
	});

	test('empty products list yields truthy no-products derived state', async () => {
		const { transport } = createTransportStub({ products: [] });
		const model = createPersonasPageModel({ transport });

		await model.loadInitial();

		expect(model.products.length === 0).toBe(true);
	});

	test('savePersona(dto) creates when no persona is selected for edit', async () => {
		const { catalog, transport } = createTransportStub();
		const model = createPersonasPageModel({ transport });
		await model.loadInitial();
		const listCallsBeforeSave = catalog.listPersonas.mock.calls.length;

		await model.savePersona({
			productId: 'p-1',
			name: 'Taylor',
			ageRange: '25-34',
			gender: 'female',
			interests: [],
			painPoints: [],
			motivations: [],
		});

		expect(catalog.createPersona).toHaveBeenCalled();
		expect(catalog.updatePersona).not.toHaveBeenCalled();
		expect(catalog.listPersonas).toHaveBeenCalledTimes(listCallsBeforeSave + 1);
		expect(model.personas.map((persona) => persona.name)).toContain('Taylor');
	});

	test('savePersona(dto) updates when editing an existing persona', async () => {
		const { catalog, transport } = createTransportStub();
		const model = createPersonasPageModel({ transport });
		await model.loadInitial();
		model.openEditForm(model.personas[0]!);

		await model.savePersona({ name: 'Alex Updated' });

		expect(catalog.updatePersona).toHaveBeenCalledWith('persona-1', { name: 'Alex Updated' });
		expect(catalog.createPersona).not.toHaveBeenCalled();
		expect(model.personas[0]?.name).toBe('Alex Updated');
	});

	test('deletePersona(id) deletes and refreshes list', async () => {
		const { catalog, transport } = createTransportStub();
		const model = createPersonasPageModel({ transport });
		await model.loadInitial();
		const listCallsBeforeDelete = catalog.listPersonas.mock.calls.length;

		await model.deletePersona('persona-1');

		expect(catalog.deletePersona).toHaveBeenCalledWith('persona-1');
		expect(catalog.listPersonas).toHaveBeenCalledTimes(listCallsBeforeDelete + 1);
		expect(model.personas).toHaveLength(0);
	});

	test('loadInitial() transport error sets error state', async () => {
		const { catalog, transport } = createTransportStub();
		catalog.listProducts.mockImplementationOnce(async () => {
			throw new Error('failed loading products');
		});
		const model = createPersonasPageModel({ transport });

		await model.loadInitial();

		expect(model.errorMessage).toBe('failed loading products');
		expect(model.hasLoaded).toBe(true);
	});
});
