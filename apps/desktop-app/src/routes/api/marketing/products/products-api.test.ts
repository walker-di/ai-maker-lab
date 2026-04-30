import { beforeEach, describe, expect, test, vi } from 'vitest';

const hoisted = (
	(vi as unknown as { hoisted?: <T>(factory: () => T) => T }).hoisted ??
	((factory: () => unknown) => factory())
) as <T>(factory: () => T) => T;

const getMarketingServicesMock = hoisted(() => vi.fn());

vi.mock('$lib/server/marketing-service', () => ({
	getMarketingServices: getMarketingServicesMock,
	toMarketingErrorResponse: (error: unknown) =>
		new Response(
			JSON.stringify({
				error: error instanceof Error ? error.message : 'Unknown error',
			}),
			{ status: 500, headers: { 'content-type': 'application/json' } },
		),
}));

function makeProduct(id: string, name: string) {
	return { id, name, description: '', targetAudience: '', features: [], benefits: [], imageUrl: undefined, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' };
}

function makePersona(id: string, productId: string, name: string) {
	return { id, productId, name, age: undefined, ageRange: 'adults', gender: 'prefer_not_to_say', occupation: '', income: '', interests: [], painPoints: [], motivations: [], description: '', avatarUrl: '', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' };
}

function fakeServices(overrides: Record<string, unknown> = {}) {
	return {
		productService: {
			list: vi.fn(async () => [] as ReturnType<typeof makeProduct>[]),
			get: vi.fn(async () => null as ReturnType<typeof makeProduct> | null),
			create: vi.fn(async (data: unknown) => makeProduct('p-new', (data as { name: string }).name)),
			update: vi.fn(async (_id: string, data: unknown) => ({ ...makeProduct('p-1', 'X'), ...(data as object) })),
			delete: vi.fn(async () => {}),
		},
		personaService: {
			listByProduct: vi.fn(async () => [] as ReturnType<typeof makePersona>[]),
			create: vi.fn(async (data: unknown) => makePersona('per-new', 'p-1', (data as { name: string }).name)),
			generateForProduct: vi.fn(async () => [makePersona('per-gen', 'p-1', 'Generated')]),
		},
		personaRepo: {
			findAll: vi.fn(async () => [] as ReturnType<typeof makePersona>[]),
		},
		...overrides,
	};
}

function jsonRequest(body: unknown, method = 'POST'): Request {
	return new Request('http://localhost/test', {
		method,
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
	});
}

describe('Product API routes', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('GET /api/marketing/products returns product list', async () => {
		const services = fakeServices();
		services.productService.list.mockResolvedValueOnce([makeProduct('p-1', 'Widget')]);
		getMarketingServicesMock.mockResolvedValueOnce(services);

		const { GET } = await import('./+server');
		const response = await GET({ url: new URL('http://localhost/api/marketing/products') } as never);

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data).toHaveLength(1);
		expect(data[0].name).toBe('Widget');
	});

	test('POST /api/marketing/products creates a product', async () => {
		const services = fakeServices();
		getMarketingServicesMock.mockResolvedValueOnce(services);

		const { POST } = await import('./+server');
		const response = await POST({ request: jsonRequest({ name: 'New Product', features: [], benefits: [] }) } as never);

		expect(response.status).toBe(201);
		expect(services.productService.create).toHaveBeenCalled();
	});

	test('POST /api/marketing/products with invalid input returns 400', async () => {
		const services = fakeServices();
		getMarketingServicesMock.mockResolvedValueOnce(services);

		const { POST } = await import('./+server');
		const response = await POST({ request: jsonRequest({}) } as never);

		expect(response.status).toBe(400);
		expect(services.productService.create).not.toHaveBeenCalled();
	});
});
