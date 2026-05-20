import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import {
	HttpMarketingCatalogTransport,
	HttpMarketingAiTransport,
	HttpMarketingStrategyTransport,
} from './http-marketing-transport';

const BASE = '/api/marketing';

let fetchMock: ReturnType<typeof vi.fn>;
const originalFetch = globalThis.fetch;

function ok(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'content-type': 'application/json' },
	});
}

function errorResponse(status: number, body: { error: string }) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' },
	});
}

beforeEach(() => {
	fetchMock = vi.fn();
	(globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
	(globalThis as { fetch: typeof fetch }).fetch = originalFetch;
	vi.restoreAllMocks();
});

describe('HttpMarketingCatalogTransport — Products', () => {
	const transport = new HttpMarketingCatalogTransport();

	test('listProducts sends GET to /api/marketing/products', async () => {
		const products = [{ id: 'p-1', name: 'Widget' }];
		fetchMock.mockResolvedValueOnce(ok(products));

		const result = await transport.listProducts();

		expect(fetchMock).toHaveBeenCalledWith(`${BASE}/products`);
		expect(result).toEqual(products);
	});

	test('getProduct sends GET to /api/marketing/products/:id', async () => {
		const product = { id: 'p-1', name: 'Widget' };
		fetchMock.mockResolvedValueOnce(ok(product));

		const result = await transport.getProduct('p-1');

		expect(fetchMock).toHaveBeenCalledWith(`${BASE}/products/p-1`);
		expect(result).toEqual(product);
	});

	test('createProduct sends POST with JSON body', async () => {
		const created = { id: 'p-2', name: 'Gadget' };
		fetchMock.mockResolvedValueOnce(ok(created, 201));

		const result = await transport.createProduct({ name: 'Gadget' });

		expect(fetchMock).toHaveBeenCalledWith(`${BASE}/products`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name: 'Gadget' }),
		});
		expect(result).toEqual(created);
	});

	test('updateProduct sends PUT with JSON body', async () => {
		const updated = { id: 'p-1', name: 'Widget Pro' };
		fetchMock.mockResolvedValueOnce(ok(updated));

		const result = await transport.updateProduct('p-1', { name: 'Widget Pro' });

		expect(fetchMock).toHaveBeenCalledWith(`${BASE}/products/p-1`, {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name: 'Widget Pro' }),
		});
		expect(result).toEqual(updated);
	});

	test('deleteProduct sends DELETE', async () => {
		fetchMock.mockResolvedValueOnce(ok({}));

		await transport.deleteProduct('p-1');

		expect(fetchMock).toHaveBeenCalledWith(`${BASE}/products/p-1`, { method: 'DELETE' });
	});

	test('generateProduct sends POST with name', async () => {
		const product = { id: 'p-3', name: 'Auto Widget' };
		fetchMock.mockResolvedValueOnce(ok(product));

		const result = await transport.generateProduct('Auto Widget');

		expect(fetchMock).toHaveBeenCalledWith(`${BASE}/products/generate`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name: 'Auto Widget' }),
		});
		expect(result).toEqual(product);
	});
});

describe('HttpMarketingCatalogTransport — Personas', () => {
	const transport = new HttpMarketingCatalogTransport();

	test('listPersonas without productId sends GET to /api/marketing/personas', async () => {
		fetchMock.mockResolvedValueOnce(ok([]));

		await transport.listPersonas();

		expect(fetchMock).toHaveBeenCalledWith(`${BASE}/personas`);
	});

	test('listPersonas with productId includes query param', async () => {
		fetchMock.mockResolvedValueOnce(ok([]));

		await transport.listPersonas('p-1');

		expect(fetchMock).toHaveBeenCalledWith(`${BASE}/personas?productId=p-1`);
	});

	test('createPersona sends POST with JSON body', async () => {
		const persona = { id: 'per-1', name: 'Busy Bee', productId: 'p-1' };
		fetchMock.mockResolvedValueOnce(ok(persona, 201));

		const result = await transport.createPersona({ name: 'Busy Bee', productId: 'p-1' });

		expect(fetchMock).toHaveBeenCalledWith(`${BASE}/personas`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name: 'Busy Bee', productId: 'p-1' }),
		});
		expect(result).toEqual(persona);
	});

	test('updatePersona sends PUT', async () => {
		const updated = { id: 'per-1', name: 'Updated Bee' };
		fetchMock.mockResolvedValueOnce(ok(updated));

		await transport.updatePersona('per-1', { name: 'Updated Bee' });

		expect(fetchMock).toHaveBeenCalledWith(`${BASE}/personas/per-1`, {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name: 'Updated Bee' }),
		});
	});

	test('deletePersona sends DELETE', async () => {
		fetchMock.mockResolvedValueOnce(ok({}));

		await transport.deletePersona('per-1');

		expect(fetchMock).toHaveBeenCalledWith(`${BASE}/personas/per-1`, { method: 'DELETE' });
	});

	test('generatePersonas sends POST to product-scoped generate route', async () => {
		const personas = [{ id: 'per-g1', name: 'Generated' }];
		fetchMock.mockResolvedValueOnce(ok(personas));

		const result = await transport.generatePersonas('p-1', 3);

		expect(fetchMock).toHaveBeenCalledWith(`${BASE}/products/p-1/personas/generate`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ count: 3 }),
		});
		expect(result).toEqual(personas);
	});
});

describe('HttpMarketingCatalogTransport — Customer Journey Maps', () => {
	const transport = new HttpMarketingCatalogTransport();

	test('listCustomerJourneyMaps without productId sends GET to /api/marketing/customer-journey-maps', async () => {
		fetchMock.mockResolvedValueOnce(ok([]));

		await transport.listCustomerJourneyMaps();

		expect(fetchMock).toHaveBeenCalledWith(`${BASE}/customer-journey-maps`);
	});

	test('listCustomerJourneyMaps with productId includes query param', async () => {
		fetchMock.mockResolvedValueOnce(ok([]));

		await transport.listCustomerJourneyMaps('p-1');

		expect(fetchMock).toHaveBeenCalledWith(`${BASE}/customer-journey-maps?productId=p-1`);
	});

	test('getCustomerJourneyMap sends GET to /api/marketing/customer-journey-maps/:id', async () => {
		const journeyMap = { id: 'cjm-1', name: 'Journey' };
		fetchMock.mockResolvedValueOnce(ok(journeyMap));

		const result = await transport.getCustomerJourneyMap('cjm-1');

		expect(fetchMock).toHaveBeenCalledWith(`${BASE}/customer-journey-maps/cjm-1`);
		expect(result).toEqual(journeyMap);
	});

	test('createCustomerJourneyMap sends POST with JSON body', async () => {
		const created = { id: 'cjm-2', name: 'New Journey', productId: 'p-1' };
		fetchMock.mockResolvedValueOnce(ok(created, 201));

		const result = await transport.createCustomerJourneyMap({ name: 'New Journey', productId: 'p-1' });

		expect(fetchMock).toHaveBeenCalledWith(`${BASE}/customer-journey-maps`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name: 'New Journey', productId: 'p-1' }),
		});
		expect(result).toEqual(created);
	});

	test('updateCustomerJourneyMap sends PUT', async () => {
		const updated = { id: 'cjm-1', name: 'Updated Journey' };
		fetchMock.mockResolvedValueOnce(ok(updated));

		await transport.updateCustomerJourneyMap('cjm-1', { name: 'Updated Journey' });

		expect(fetchMock).toHaveBeenCalledWith(`${BASE}/customer-journey-maps/cjm-1`, {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name: 'Updated Journey' }),
		});
	});

	test('deleteCustomerJourneyMap sends DELETE', async () => {
		fetchMock.mockResolvedValueOnce(ok({}));

		await transport.deleteCustomerJourneyMap('cjm-1');

		expect(fetchMock).toHaveBeenCalledWith(`${BASE}/customer-journey-maps/cjm-1`, { method: 'DELETE' });
	});
});

describe('HttpMarketingCatalogTransport — error handling', () => {
	const transport = new HttpMarketingCatalogTransport();

	test('non-2xx response throws with server error message', async () => {
		fetchMock.mockResolvedValueOnce(errorResponse(404, { error: 'Product not found' }));

		await expect(transport.getProduct('missing')).rejects.toThrow('Product not found');
	});

	test('non-2xx response without error field uses status fallback', async () => {
		fetchMock.mockResolvedValueOnce(
			new Response('not json', { status: 500, headers: { 'content-type': 'text/plain' } }),
		);

		await expect(transport.listProducts()).rejects.toThrow('Request failed with status 500');
	});

	test('non-2xx with empty JSON body uses status fallback', async () => {
		fetchMock.mockResolvedValueOnce(errorResponse(422, {} as { error: string }));

		await expect(transport.createProduct({ name: '' })).rejects.toThrow('Request failed with status 422');
	});
});

describe('HttpMarketingAiTransport', () => {
	const transport = new HttpMarketingAiTransport();

	test('generatePersonas sends to product-scoped generate route', async () => {
		const personas = [{ id: 'g1', name: 'AI Persona' }];
		fetchMock.mockResolvedValueOnce(ok(personas));

		const result = await transport.generatePersonas('p-1', 5);

		expect(fetchMock).toHaveBeenCalledWith(`${BASE}/products/p-1/personas/generate`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ count: 5 }),
		});
		expect(result).toEqual(personas);
	});

	test('generateStrategy sends productId and optional campaignId', async () => {
		fetchMock.mockResolvedValueOnce(ok({ id: 's-1' }));

		await transport.generateStrategy('p-1', 'c-1');

		expect(fetchMock).toHaveBeenCalledWith(`${BASE}/strategies/generate`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ productId: 'p-1', campaignId: 'c-1' }),
		});
	});
});

describe('HttpMarketingStrategyTransport', () => {
	const transport = new HttpMarketingStrategyTransport();

	test('listStrategies without productId sends GET to /api/marketing/strategies', async () => {
		fetchMock.mockResolvedValueOnce(ok([]));

		await transport.listStrategies();

		expect(fetchMock).toHaveBeenCalledWith(`${BASE}/strategies`);
	});

	test('listStrategies with productId includes query param', async () => {
		fetchMock.mockResolvedValueOnce(ok([]));

		await transport.listStrategies('p-1');

		expect(fetchMock).toHaveBeenCalledWith(`${BASE}/strategies?productId=p-1`);
	});

	test('deleteStrategy sends DELETE', async () => {
		fetchMock.mockResolvedValueOnce(ok({}));

		await transport.deleteStrategy('s-1');

		expect(fetchMock).toHaveBeenCalledWith(`${BASE}/strategies/s-1`, { method: 'DELETE' });
	});
});
