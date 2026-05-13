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

	test('calls narration model management endpoints with expected payloads', async () => {
		const fetchMock = vi.fn(async () => jsonResponse({ ok: true }));
		stubFetch(fetchMock as unknown as typeof fetch);
		const transport = new WebStoryboardTransport();

		await transport.getNarrationOptions({ provider: 'huggingface-local', model: 'Xenova/mms-tts-eng' });
		await transport.getNarrationModelStatus({ provider: 'huggingface-local', model: 'onnx-community/Kokoro-82M-v1.0-ONNX' });
		await transport.downloadNarrationModel({ provider: 'huggingface-local', model: 'onnx-community/Kokoro-82M-v1.0-ONNX' });

		expect(fetchMock).toHaveBeenNthCalledWith(
			1,
			'/api/marketing/narration/options?provider=huggingface-local&model=Xenova%2Fmms-tts-eng',
			expect.objectContaining({ headers: expect.objectContaining({ 'content-type': 'application/json' }) }),
		);
		expect(fetchMock).toHaveBeenNthCalledWith(
			2,
			'/api/marketing/narration/models/status?provider=huggingface-local&model=onnx-community%2FKokoro-82M-v1.0-ONNX',
			expect.objectContaining({ headers: expect.objectContaining({ 'content-type': 'application/json' }) }),
		);
		expect(fetchMock).toHaveBeenNthCalledWith(
			3,
			'/api/marketing/narration/models/download',
			expect.objectContaining({
				method: 'POST',
				body: JSON.stringify({ provider: 'huggingface-local', model: 'onnx-community/Kokoro-82M-v1.0-ONNX' }),
			}),
		);
	});

	test('calls narration endpoints for vibevoice-local provider', async () => {
		const fetchMock = vi.fn(async () => jsonResponse({ ok: true }));
		stubFetch(fetchMock as unknown as typeof fetch);
		const transport = new WebStoryboardTransport();

		await transport.getNarrationOptions({ provider: 'vibevoice-local', model: 'microsoft/VibeVoice-1.5B' });
		await transport.getNarrationModelStatus({ provider: 'vibevoice-local', model: 'microsoft/VibeVoice-1.5B' });
		await transport.downloadNarrationModel({ provider: 'vibevoice-local', model: 'microsoft/VibeVoice-1.5B' });

		expect(fetchMock).toHaveBeenNthCalledWith(
			1,
			'/api/marketing/narration/options?provider=vibevoice-local&model=microsoft%2FVibeVoice-1.5B',
			expect.objectContaining({ headers: expect.objectContaining({ 'content-type': 'application/json' }) }),
		);
		expect(fetchMock).toHaveBeenNthCalledWith(
			2,
			'/api/marketing/narration/models/status?provider=vibevoice-local&model=microsoft%2FVibeVoice-1.5B',
			expect.objectContaining({ headers: expect.objectContaining({ 'content-type': 'application/json' }) }),
		);
		expect(fetchMock).toHaveBeenNthCalledWith(
			3,
			'/api/marketing/narration/models/download',
			expect.objectContaining({
				method: 'POST',
				body: JSON.stringify({ provider: 'vibevoice-local', model: 'microsoft/VibeVoice-1.5B' }),
			}),
		);
	});
});
