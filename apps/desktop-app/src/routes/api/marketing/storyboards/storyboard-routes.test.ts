import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { closeDb } from 'domain/infrastructure';
import { resetMarketingServicesForTest } from '$lib/server/marketing-service';

/**
 * Real-DB integration tests using mem://.
 * All tests in this suite share one DB connection (mem:// is isolated per process run).
 */

beforeAll(() => {
	process.env.SURREAL_HOST = 'mem://';
	process.env.SURREAL_NS = 'test_storyboard_routes';
	process.env.SURREAL_DB = `routes_${Math.random().toString(36).slice(2)}`;
	resetMarketingServicesForTest();
});

afterAll(async () => {
	resetMarketingServicesForTest();
	await closeDb();
});

describe('storyboard API routes (real mem:// DB)', () => {
	test('GET /api/marketing/storyboards → 200 []', async () => {
		const { GET } = await import('./+server');
		const response = await GET({} as Parameters<typeof GET>[0]);
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toEqual([]);
	});

	test('POST /api/marketing/storyboards → 201 with created storyboard', async () => {
		const { POST } = await import('./+server');
		const request = new Request('http://localhost/api/marketing/storyboards', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name: 'Smoke test storyboard' }),
		});
		const response = await POST({ request } as Parameters<typeof POST>[0]);
		expect(response.status).toBe(201);
		const body = await response.json();
		expect(body).toMatchObject({ name: 'Smoke test storyboard' });
		expect(typeof body.id).toBe('string');
	});

	test('GET /api/marketing/storyboards → 200 with item after create', async () => {
		const { GET } = await import('./+server');
		const response = await GET({} as Parameters<typeof GET>[0]);
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.length).toBeGreaterThanOrEqual(1);
	});

	test('GET /api/marketing/storyboards/:id → 200 for existing storyboard', async () => {
		const { POST } = await import('./+server');
		const createRequest = new Request('http://localhost/api/marketing/storyboards', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name: 'Detail test' }),
		});
		const created = await (await POST({ request: createRequest } as Parameters<typeof POST>[0])).json();

		const { GET } = await import('./[storyboardId]/+server');
		const response = await GET({ params: { storyboardId: created.id } } as Parameters<typeof GET>[0]);
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toMatchObject({ id: created.id, name: 'Detail test' });
	});

	test('POST invalid body → 400', async () => {
		const { POST } = await import('./+server');
		const request = new Request('http://localhost/api/marketing/storyboards', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({}),
		});
		const response = await POST({ request } as Parameters<typeof POST>[0]);
		expect(response.status).toBe(400);
	});

	test('GET unknown id → 404', async () => {
		const { GET } = await import('./[storyboardId]/+server');
		const response = await GET({ params: { storyboardId: 'storyboard:doesnotexist' } } as Parameters<typeof GET>[0]);
		expect(response.status).toBe(404);
	});
});
