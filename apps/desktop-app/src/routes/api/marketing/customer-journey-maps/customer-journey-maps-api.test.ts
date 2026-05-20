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

function makeJourneyMap(id: string, productId: string, name: string) {
	return { id, productId, name, description: '', scenario: '', goals: [], status: 'draft', tags: [], stages: [], lanes: [], cells: [], touchpoints: [], emotionPoints: [], opportunities: [], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' };
}

function fakeServices(overrides: Record<string, unknown> = {}) {
	return {
		productService: {
			list: vi.fn(async () => [] as ReturnType<typeof makeProduct>[]),
			get: vi.fn(async () => null as ReturnType<typeof makeProduct> | null),
			create: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
		},
		customerJourneyMapService: {
			list: vi.fn(async () => [] as ReturnType<typeof makeJourneyMap>[]),
			listByProduct: vi.fn(async () => [] as ReturnType<typeof makeJourneyMap>[]),
			get: vi.fn(async () => null as ReturnType<typeof makeJourneyMap> | null),
			create: vi.fn(async (data: unknown) => makeJourneyMap('cjm-new', 'p-1', (data as { name: string }).name)),
			update: vi.fn(),
			delete: vi.fn(),
		},
		customerJourneyMapRepo: {
			findAll: vi.fn(async () => [] as ReturnType<typeof makeJourneyMap>[]),
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

describe('Customer Journey Map API routes', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('GET /api/marketing/customer-journey-maps returns all journey maps', async () => {
		const services = fakeServices();
		services.customerJourneyMapRepo.findAll.mockResolvedValueOnce([makeJourneyMap('cjm-1', 'p-1', 'Awareness')]);
		getMarketingServicesMock.mockResolvedValueOnce(services);

		const { GET } = await import('./+server');
		const response = await GET({
			url: new URL('http://localhost/api/marketing/customer-journey-maps'),
		} as never);

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data).toHaveLength(1);
		expect(data[0].name).toBe('Awareness');
	});

	test('GET /api/marketing/customer-journey-maps?productId=p-1 returns scoped list', async () => {
		const services = fakeServices();
		services.customerJourneyMapService.listByProduct.mockResolvedValueOnce([makeJourneyMap('cjm-1', 'p-1', 'Scoped')]);
		getMarketingServicesMock.mockResolvedValueOnce(services);

		const { GET } = await import('./+server');
		const response = await GET({
			url: new URL('http://localhost/api/marketing/customer-journey-maps?productId=p-1'),
		} as never);

		expect(response.status).toBe(200);
		expect(services.customerJourneyMapService.listByProduct).toHaveBeenCalledWith('p-1');
	});

	test('POST /api/marketing/customer-journey-maps creates journey map for existing product', async () => {
		const services = fakeServices();
		services.productService.get.mockResolvedValueOnce(makeProduct('p-1', 'Widget'));
		getMarketingServicesMock.mockResolvedValueOnce(services);

		const { POST } = await import('./+server');
		const response = await POST({
			request: jsonRequest({ name: 'New Journey', productId: 'p-1', status: 'draft', goals: [], tags: [], stages: [], lanes: [], cells: [], touchpoints: [], emotionPoints: [], opportunities: [] }),
		} as never);

		expect(response.status).toBe(201);
		expect(services.customerJourneyMapService.create).toHaveBeenCalled();
	});

	test('POST /api/marketing/customer-journey-maps with missing productId returns 400', async () => {
		const services = fakeServices();
		getMarketingServicesMock.mockResolvedValueOnce(services);

		const { POST } = await import('./+server');
		const response = await POST({
			request: jsonRequest({ name: 'No Product Journey' }),
		} as never);

		expect(response.status).toBe(400);
		expect(services.customerJourneyMapService.create).not.toHaveBeenCalled();
	});

	test('POST /api/marketing/customer-journey-maps for unknown product returns 404', async () => {
		const services = fakeServices();
		services.productService.get.mockResolvedValueOnce(null);
		getMarketingServicesMock.mockResolvedValueOnce(services);

		const { POST } = await import('./+server');
		const response = await POST({
			request: jsonRequest({ name: 'Orphan', productId: 'missing', status: 'draft', goals: [], tags: [], stages: [], lanes: [], cells: [], touchpoints: [], emotionPoints: [], opportunities: [] }),
		} as never);

		expect(response.status).toBe(404);
		expect(services.customerJourneyMapService.create).not.toHaveBeenCalled();
	});

	test('GET /api/marketing/customer-journey-maps/:id returns journey map', async () => {
		const services = fakeServices();
		services.customerJourneyMapService.get.mockResolvedValueOnce(makeJourneyMap('cjm-1', 'p-1', 'Found'));
		getMarketingServicesMock.mockResolvedValueOnce(services);

		const { GET } = await import('./[id]/+server');
		const response = await GET({ params: { id: 'cjm-1' } } as never);

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.name).toBe('Found');
	});

	test('GET /api/marketing/customer-journey-maps/:id returns 404 when not found', async () => {
		const services = fakeServices();
		services.customerJourneyMapService.get.mockResolvedValueOnce(null);
		getMarketingServicesMock.mockResolvedValueOnce(services);

		const { GET } = await import('./[id]/+server');
		const response = await GET({ params: { id: 'missing' } } as never);

		expect(response.status).toBe(404);
	});

	test('PUT /api/marketing/customer-journey-maps/:id updates journey map', async () => {
		const services = fakeServices();
		services.customerJourneyMapService.get.mockResolvedValueOnce(makeJourneyMap('cjm-1', 'p-1', 'Old'));
		getMarketingServicesMock.mockResolvedValueOnce(services);

		const { PUT } = await import('./[id]/+server');
		const response = await PUT({
			params: { id: 'cjm-1' },
			request: jsonRequest({ name: 'Updated' }, 'PUT'),
		} as never);

		expect(response.status).toBe(200);
		expect(services.customerJourneyMapService.update).toHaveBeenCalledWith('cjm-1', expect.objectContaining({ name: 'Updated' }));
	});

	test('DELETE /api/marketing/customer-journey-maps/:id deletes journey map', async () => {
		const services = fakeServices();
		services.customerJourneyMapService.get.mockResolvedValueOnce(makeJourneyMap('cjm-1', 'p-1', 'To Delete'));
		getMarketingServicesMock.mockResolvedValueOnce(services);

		const { DELETE } = await import('./[id]/+server');
		const response = await DELETE({ params: { id: 'cjm-1' } } as never);

		expect(response.status).toBe(200);
		expect(services.customerJourneyMapService.delete).toHaveBeenCalledWith('cjm-1');
	});
});
