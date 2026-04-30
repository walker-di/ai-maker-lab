import { describe, expect, test } from 'bun:test';
import path from 'node:path';
import { resolveMarketingAssetInputUrl } from './FfmpegMarketingVideoExporter.js';

describe('resolveMarketingAssetInputUrl', () => {
	test('maps public marketing asset URLs into the configured asset root', () => {
		const tempDir = path.join(path.sep, 'tmp', 'marketing-assets');

		expect(resolveMarketingAssetInputUrl('/marketing-assets/images/frame.png', {
			tempDir,
			publicBaseUrl: '/marketing-assets',
		})).toBe(path.join(tempDir, 'images', 'frame.png'));
	});

	test('rejects encoded traversal outside the asset root', () => {
		expect(() => resolveMarketingAssetInputUrl('/marketing-assets/images/%2e%2e/%2e%2e/secret.txt', {
			tempDir: path.join(path.sep, 'tmp', 'marketing-assets'),
			publicBaseUrl: '/marketing-assets',
		})).toThrow('Invalid marketing asset path');
	});

	test('rejects unsupported public asset kinds', () => {
		expect(() => resolveMarketingAssetInputUrl('/marketing-assets/private/file.txt', {
			tempDir: path.join(path.sep, 'tmp', 'marketing-assets'),
			publicBaseUrl: '/marketing-assets',
		})).toThrow('Invalid marketing asset path');
	});

	test('leaves unrelated remote URLs unchanged', () => {
		const url = 'https://example.com/marketing-assets/images/frame.png';

		expect(resolveMarketingAssetInputUrl(url, {
			tempDir: path.join(path.sep, 'tmp', 'marketing-assets'),
			publicBaseUrl: '/marketing-assets',
		})).toBe(url);
	});
});
