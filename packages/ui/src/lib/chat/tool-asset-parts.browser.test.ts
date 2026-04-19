import { describe, expect, test } from 'vitest';
import { ONE_PIXEL_PNG_BASE64 } from '../../../../../packages/domain/src/application/chat/__test-helpers__/test-fixtures.js';
import {
	extractAssistantAssetParts,
	getAssistantPreviewImageUrl,
	getToolAssetExtractionOptions,
} from './tool-asset-parts.js';

describe('tool asset parts', () => {
	test('extracts preview images from stringified json result payloads', () => {
		expect(
			extractAssistantAssetParts({
				result: JSON.stringify({
					images: [
						{
							image_url: 'https://cdn.openai.com/generated/stringified-preview',
							filename: 'stringified-preview.png',
						},
					],
				}),
			}),
		).toEqual([
			{
				type: 'image',
				url: 'https://cdn.openai.com/generated/stringified-preview',
				mimeType: undefined,
				name: 'stringified-preview.png',
				alt: 'stringified-preview.png',
			},
		]);
	});

	test('treats extensionless urls as images when the payload implies image media', () => {
		expect(
			getAssistantPreviewImageUrl({
				images: [
					{
						image_url: 'https://cdn.openai.com/generated/extensionless-preview',
						filename: 'extensionless-preview.png',
					},
				],
			}),
		).toBe('https://cdn.openai.com/generated/extensionless-preview');
	});

	test('builds data urls for camelCase base64 image fields without explicit mime', () => {
		expect(
			extractAssistantAssetParts({
				result: {
					images: [
						{
							b64Json:
								'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9sZrxh8AAAAASUVORK5CYII=',
							filename: 'camel-b64.png',
							type: 'image',
						},
					],
				},
			}),
		).toEqual([
			{
				type: 'image',
				url: expect.stringMatching(/^data:image\/png;base64,/),
				mimeType: 'image/png',
				name: 'camel-b64.png',
				alt: 'camel-b64.png',
			},
		]);
	});

	test('infers image previews from naked image_generation base64 result payloads', () => {
		expect(
			extractAssistantAssetParts(
				{ result: ONE_PIXEL_PNG_BASE64 },
				getToolAssetExtractionOptions('image_generation'),
			),
		).toEqual([
			{
				type: 'image',
				url: expect.stringMatching(/^data:image\/png;base64,/),
				mimeType: 'image/png',
				name: undefined,
				alt: 'Generated image',
			},
		]);
		expect(
			getAssistantPreviewImageUrl(
				{ result: ONE_PIXEL_PNG_BASE64 },
				getToolAssetExtractionOptions('image_generation'),
			),
		).toEqual(expect.stringMatching(/^data:image\/png;base64,/));
	});
});
