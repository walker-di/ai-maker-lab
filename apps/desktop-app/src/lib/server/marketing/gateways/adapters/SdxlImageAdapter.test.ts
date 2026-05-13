import { describe, expect, test } from 'vitest';
import { SdxlImageAdapter } from './SdxlImageAdapter';

describe('SdxlImageAdapter', () => {
	const adapter = new SdxlImageAdapter();

	test('supports stability-ai/sdxl', () => {
		expect(adapter.supportedModels).toContain('stability-ai/sdxl');
	});

	test('builds input with width/height instead of aspect_ratio', () => {
		const input = adapter.buildInput({ prompt: 'a landscape', aspectRatio: '16:9' });
		expect(input.width).toBe(1344);
		expect(input.height).toBe(768);
		expect(input.prompt).toBe('a landscape');
		expect(input).not.toHaveProperty('aspect_ratio');
	});

	test('includes SDXL-specific parameters', () => {
		const input = adapter.buildInput({ prompt: 'test', aspectRatio: '1:1' });
		expect(input.scheduler).toBe('K_EULER');
		expect(input.num_inference_steps).toBe(25);
		expect(input.guidance_scale).toBe(7.5);
		expect(input.refine).toBe('expert_ensemble_refiner');
		expect(input.high_noise_frac).toBe(0.8);
		expect(input.num_outputs).toBe(1);
	});

	test('defaults to 1024x1024 for 1:1', () => {
		const input = adapter.buildInput({ prompt: 'square', aspectRatio: '1:1' });
		expect(input.width).toBe(1024);
		expect(input.height).toBe(1024);
	});
});
