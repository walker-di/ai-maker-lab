import { describe, expect, test } from 'vitest';
import { FluxImageAdapter } from './FluxImageAdapter';

describe('FluxImageAdapter', () => {
	const adapter = new FluxImageAdapter();

	test('supports flux model IDs', () => {
		expect(adapter.supportedModels).toContain('black-forest-labs/flux-1.1-pro');
		expect(adapter.supportedModels).toContain('black-forest-labs/flux-schnell');
		expect(adapter.supportedModels).toContain('black-forest-labs/flux-dev');
	});

	test('builds input with aspect_ratio for Flux', () => {
		const input = adapter.buildInput({ prompt: 'a cat', aspectRatio: '16:9' });
		expect(input).toEqual({
			prompt: 'a cat',
			aspect_ratio: '16:9',
			output_format: 'jpg',
			output_quality: 80,
			safety_tolerance: 2,
			prompt_upsampling: true,
		});
	});

	test('defaults aspect_ratio to 1:1', () => {
		const input = adapter.buildInput({ prompt: 'a dog' });
		expect(input.aspect_ratio).toBe('1:1');
	});
});
