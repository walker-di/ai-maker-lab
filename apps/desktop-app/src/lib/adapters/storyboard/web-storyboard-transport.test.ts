import { afterEach, describe, expect, test, vi } from 'vitest';
import { WebStoryboardTransport, StoryboardTransportError } from './web-storyboard-transport';

function jsonResponse(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' },
	});
}

describe('WebStoryboardTransport', () => {
	const originalFetch = globalThis.fetch;

	function stubFetch(mock: typeof fetch) {
		(globalThis as { fetch: typeof fetch }).fetch = mock;
	}

	afterEach(() => {
		(globalThis as { fetch: typeof fetch }).fetch = originalFetch;
	});

	test('keeps storyboard API paths inside the adapter', async () => {
		const fetchMock = vi.fn(async () =>
			jsonResponse({
				id: 'story-1',
				name: 'Launch',
				frameCount: 0,
				createdAt: 'now',
				updatedAt: 'now',
			}),
		);
		stubFetch(fetchMock as unknown as typeof fetch);

		await new WebStoryboardTransport().createStoryboard({ name: 'Launch' });

		expect(fetchMock).toHaveBeenCalledWith(
			'/api/marketing/storyboards',
			expect.objectContaining({
				method: 'POST',
				body: JSON.stringify({ name: 'Launch' }),
			}),
		);
	});

	test('maps non-2xx responses to useful errors', async () => {
		stubFetch(
			vi.fn(async () => jsonResponse({ error: 'Storyboard not found' }, 404)) as unknown as typeof fetch,
		);

		const err = await new WebStoryboardTransport().getStoryboard('missing').catch((e) => e);
		expect(err).toBeInstanceOf(StoryboardTransportError);
		expect((err as StoryboardTransportError).kind).toBe('not-found');
		expect((err as StoryboardTransportError).technicalMessage).toBe('Storyboard not found');
	});

	test('500 with DB timeout message → kind: backend-unavailable', async () => {
		stubFetch(
			vi.fn(async () =>
				jsonResponse({ error: '[DB] connect to surrealkv:// timed out after 30000ms' }, 500),
			) as unknown as typeof fetch,
		);

		const err = await new WebStoryboardTransport().listStoryboards().catch((e) => e);
		expect(err).toBeInstanceOf(StoryboardTransportError);
		expect((err as StoryboardTransportError).kind).toBe('backend-unavailable');
		expect((err as StoryboardTransportError).status).toBe(500);
	});

	test('404 response → kind: not-found', async () => {
		stubFetch(
			vi.fn(async () => jsonResponse({ error: 'Storyboard not found' }, 404)) as unknown as typeof fetch,
		);

		const err = await new WebStoryboardTransport().getStoryboard('x').catch((e) => e);
		expect(err).toBeInstanceOf(StoryboardTransportError);
		expect((err as StoryboardTransportError).kind).toBe('not-found');
	});

	test('serializes optional audio model config for frame asset generation', async () => {
		const fetchMock = vi.fn(async () => jsonResponse({ id: 'frame-1' }));
		stubFetch(fetchMock as unknown as typeof fetch);

		await new WebStoryboardTransport().generateFrameAsset('story-1', 'frame-1', 'narrationAudio', {
			textProvider: 'openai',
			textModel: 'gpt-4o-mini',
			imageProvider: 'openai',
			imageModel: 'gpt-image-1',
			audioProvider: 'huggingface-local',
			audioModel: 'onnx-community/Kokoro-82M-v1.0-ONNX',
			audioVoice: 'af_heart',
			audioLanguage: 'en',
		});

		expect(fetchMock).toHaveBeenCalledWith(
			'/api/marketing/storyboards/story-1/frames/frame-1/generate-asset',
			expect.objectContaining({
				method: 'POST',
				body: JSON.stringify({
					assetType: 'narrationAudio',
					modelConfig: {
						textProvider: 'openai',
						textModel: 'gpt-4o-mini',
						imageProvider: 'openai',
						imageModel: 'gpt-image-1',
						audioProvider: 'huggingface-local',
						audioModel: 'onnx-community/Kokoro-82M-v1.0-ONNX',
						audioVoice: 'af_heart',
						audioLanguage: 'en',
					},
				}),
			}),
		);
	});

	test('400 response → kind: validation', async () => {
		stubFetch(
			vi.fn(async () => jsonResponse({ error: 'name is required' }, 400)) as unknown as typeof fetch,
		);

		const err = await new WebStoryboardTransport().createStoryboard({ name: '' }).catch((e) => e);
		expect(err).toBeInstanceOf(StoryboardTransportError);
		expect((err as StoryboardTransportError).kind).toBe('validation');
	});
});
