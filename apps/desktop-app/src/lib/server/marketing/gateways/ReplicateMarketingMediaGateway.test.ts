import { describe, expect, test, vi } from 'vitest';

const runMock = vi.fn();

vi.mock('replicate', () => ({
	default: class MockReplicate {
		run = runMock;
	},
}));

describe('ReplicateMarketingMediaGateway', () => {
	test('passes storyboard image aspect ratio to Replicate', async () => {
		runMock.mockResolvedValueOnce('https://example.test/image.jpg');
		const { ReplicateMarketingMediaGateway } = await import('./ReplicateMarketingMediaGateway');
		const gateway = new ReplicateMarketingMediaGateway('test-key');

		const result = await gateway.generateImage('background prompt', undefined, { aspectRatio: '16:9' });

		expect(result.url).toBe('https://example.test/image.jpg');
		expect(runMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
			input: expect.objectContaining({ aspect_ratio: '16:9' }),
			wait: { mode: 'block' },
		}));
	});

	test('extracts URL from FileOutput object with .url() method', async () => {
		const fakeFileOutput = {
			url: () => new URL('https://replicate.delivery/output/image.jpg'),
			toString: () => 'https://replicate.delivery/output/image.jpg',
		};
		runMock.mockResolvedValueOnce(fakeFileOutput);
		const { ReplicateMarketingMediaGateway } = await import('./ReplicateMarketingMediaGateway');
		const gateway = new ReplicateMarketingMediaGateway('test-key');

		const result = await gateway.generateImage('a cat', undefined, { aspectRatio: '1:1' });
		expect(result.url).toBe('https://replicate.delivery/output/image.jpg');
	});

	test('extracts URL from array of FileOutput objects', async () => {
		const fakeFileOutput = {
			url: () => new URL('https://replicate.delivery/output/image2.jpg'),
			toString: () => 'https://replicate.delivery/output/image2.jpg',
		};
		runMock.mockResolvedValueOnce([fakeFileOutput]);
		const { ReplicateMarketingMediaGateway } = await import('./ReplicateMarketingMediaGateway');
		const gateway = new ReplicateMarketingMediaGateway('test-key');

		const result = await gateway.generateImage('a dog', undefined, { aspectRatio: '16:9' });
		expect(result.url).toBe('https://replicate.delivery/output/image2.jpg');
	});

	test('normalizes BGM generation output URLs', async () => {
		runMock.mockResolvedValueOnce(['https://example.test/music.mp3']);
		const { ReplicateMarketingMediaGateway } = await import('./ReplicateMarketingMediaGateway');
		const gateway = new ReplicateMarketingMediaGateway('test-key');

		await expect(gateway.generate('upbeat music', 5)).resolves.toEqual({ url: 'https://example.test/music.mp3' });
	});

	test('throws when output has no extractable URL', async () => {
		runMock.mockResolvedValueOnce(null);
		const { ReplicateMarketingMediaGateway } = await import('./ReplicateMarketingMediaGateway');
		const gateway = new ReplicateMarketingMediaGateway('test-key');

		await expect(gateway.generateImage('test', undefined, {})).rejects.toThrow('Replicate image generation returned no URL.');
	});
});
