import { afterEach, describe, expect, test, vi } from 'vitest';
import { WebStoryboardTransport } from './web-storyboard-transport';

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

		await expect(new WebStoryboardTransport().getStoryboard('missing')).rejects.toThrow('Storyboard not found');
	});
});
