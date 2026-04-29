import { afterEach, describe, expect, test, vi } from 'vitest';
import { WebStoryboardTransport, StoryboardTransportError } from './web-storyboard-transport';

function jsonResponse(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' },
	});
}

describe('WebStoryboardTransport', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	test('keeps storyboard API paths inside the adapter', async () => {
		const fetchMock = vi.fn(async () => jsonResponse({ id: 'story-1', name: 'Launch', frameCount: 0, createdAt: 'now', updatedAt: 'now' }));
		vi.stubGlobal('fetch', fetchMock);

		await new WebStoryboardTransport().createStoryboard({ name: 'Launch' });

		expect(fetchMock).toHaveBeenCalledWith('/api/marketing/storyboards', expect.objectContaining({
			method: 'POST',
			body: JSON.stringify({ name: 'Launch' }),
		}));
	});

	test('maps non-2xx responses to useful errors', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'Storyboard not found' }, 404)));

		const err = await new WebStoryboardTransport().getStoryboard('missing').catch((e) => e);
		expect(err).toBeInstanceOf(StoryboardTransportError);
		expect((err as StoryboardTransportError).kind).toBe('not-found');
		expect((err as StoryboardTransportError).technicalMessage).toBe('Storyboard not found');
	});

	test('500 with DB timeout message → kind: backend-unavailable', async () => {
		vi.stubGlobal('fetch', vi.fn(async () =>
			jsonResponse({ error: '[DB] connect to surrealkv:// timed out after 30000ms' }, 500),
		));

		const err = await new WebStoryboardTransport().listStoryboards().catch((e) => e);
		expect(err).toBeInstanceOf(StoryboardTransportError);
		expect((err as StoryboardTransportError).kind).toBe('backend-unavailable');
		expect((err as StoryboardTransportError).status).toBe(500);
	});

	test('404 response → kind: not-found', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'Storyboard not found' }, 404)));

		const err = await new WebStoryboardTransport().getStoryboard('x').catch((e) => e);
		expect(err).toBeInstanceOf(StoryboardTransportError);
		expect((err as StoryboardTransportError).kind).toBe('not-found');
	});

	test('400 response → kind: validation', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'name is required' }, 400)));

		const err = await new WebStoryboardTransport().createStoryboard({ name: '' }).catch((e) => e);
		expect(err).toBeInstanceOf(StoryboardTransportError);
		expect((err as StoryboardTransportError).kind).toBe('validation');
	});
});
