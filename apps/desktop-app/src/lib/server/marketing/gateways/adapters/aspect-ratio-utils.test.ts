import { describe, expect, test } from 'vitest';
import { aspectRatioToDimensions } from './aspect-ratio-utils';

describe('aspectRatioToDimensions', () => {
	test('returns 1024x1024 for 1:1', () => {
		expect(aspectRatioToDimensions('1:1')).toEqual({ width: 1024, height: 1024 });
	});

	test('returns 1344x768 for 16:9', () => {
		expect(aspectRatioToDimensions('16:9')).toEqual({ width: 1344, height: 768 });
	});

	test('returns 768x1344 for 9:16', () => {
		expect(aspectRatioToDimensions('9:16')).toEqual({ width: 768, height: 1344 });
	});

	test('defaults to 1:1 for undefined', () => {
		expect(aspectRatioToDimensions()).toEqual({ width: 1024, height: 1024 });
	});

	test('computes dimensions for unknown ratio', () => {
		const result = aspectRatioToDimensions('7:3');
		expect(result.width).toBeGreaterThan(result.height);
		expect(result.width % 64).toBe(0);
		expect(result.height % 64).toBe(0);
	});
});
