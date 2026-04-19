import { describe, expect, test } from 'vitest';
import {
	extractAssistantText,
	toAssistantMessageParts,
	toPersistedAssistantMessageParts,
	toToolPreviewParts,
} from './ai-sdk-message-parts';
import {
	HOSTED_TOOL_FIXTURES,
	ONE_PIXEL_PNG_BASE64,
	getHostedToolFixture,
} from '../../../../../../packages/domain/src/application/chat/__test-helpers__/test-fixtures';

describe('ai-sdk message parts', () => {
	test('normalizes streamed text and image parts for persistence', () => {
		const parts = toPersistedAssistantMessageParts([
			{ type: 'text', text: 'Here is a panda.' },
			{
				type: 'file',
				mimeType: 'image/png',
				filename: 'panda.png',
				data: ONE_PIXEL_PNG_BASE64,
			},
		]);

		expect(parts).toEqual([
			{ type: 'text', text: 'Here is a panda.' },
			{
				type: 'image',
				url: expect.stringMatching(/^data:image\/png;base64,/),
				mimeType: 'image/png',
				name: 'panda.png',
				alt: 'panda.png',
			},
		]);
	});

	test('merges fragmented text parts around non-text annotations without injecting paragraph breaks', () => {
		const parts = toAssistantMessageParts([
			{ type: 'text', text: 'Here are key details:\n\n- XE shows mid-market rate ' },
			{ type: 'source-url', url: 'https://xe.com', sourceId: 'xe' },
			{ type: 'text', text: '\n- TradingView reports 4.9896 BRL ' },
			{ type: 'source-url', url: 'https://tradingview.com', sourceId: 'tv' },
			{ type: 'text', text: '\n- Bloomberg shows 4.9918 BRL' },
		]);

		expect(parts).toEqual([
			{
				type: 'text',
				text:
					'Here are key details:\n\n- XE shows mid-market rate \n- TradingView reports 4.9896 BRL \n- Bloomberg shows 4.9918 BRL',
			},
		]);
	});

	test('drops empty/whitespace-only text fragments after merging', () => {
		const parts = toAssistantMessageParts([
			{ type: 'text', text: '   ' },
			{ type: 'text', text: '\n\n' },
		]);

		expect(parts).toEqual([]);
	});

	test('extractAssistantText keeps only normalized text parts', () => {
		expect(
			extractAssistantText([
				{ type: 'text', text: 'Line one' },
				{
					type: 'image',
					url: 'https://example.com/panda.png',
					name: 'panda.png',
				},
				{ type: 'text', text: 'Line two' },
			]),
		).toBe('Line one\n\nLine two');
	});

	test('assistant message mapper accepts persisted assistant parts', () => {
		expect(
			toAssistantMessageParts([
				{ type: 'text', text: 'Here is a panda.' },
				{
					type: 'image',
					url: 'https://example.com/panda.png',
					mimeType: 'image/png',
					name: 'panda.png',
					alt: 'Generated panda',
				},
			]),
		).toEqual([
			{ type: 'text', text: 'Here is a panda.' },
			{
				type: 'image',
				url: 'https://example.com/panda.png',
				mimeType: 'image/png',
				name: 'panda.png',
				alt: 'Generated panda',
			},
		]);
	});

	test('tool preview mapper finds nested result images with extensionless URLs', () => {
		expect(
			toToolPreviewParts({
				result: {
					images: [
						{
							image_url: 'https://cdn.openai.com/generated/panda',
							mime_type: 'image/png',
							filename: 'panda.png',
						},
					],
				},
			}),
		).toEqual([
			{
				type: 'image',
				url: 'https://cdn.openai.com/generated/panda',
				mimeType: 'image/png',
				name: 'panda.png',
				alt: 'panda.png',
			},
		]);
	});

	test('tool preview mapper supports snake_case base64 image payloads', () => {
		expect(
			toToolPreviewParts({
				result: {
					images: [
						{
							b64_json: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9sZrxh8AAAAASUVORK5CYII=',
							mime_type: 'image/png',
							filename: 'panda-inline.png',
						},
					],
				},
			}),
		).toEqual([
			{
				type: 'image',
				url: expect.stringMatching(/^data:image\/png;base64,/),
				mimeType: 'image/png',
				name: 'panda-inline.png',
				alt: 'panda-inline.png',
			},
		]);
	});

	test('tool preview mapper decodes stringified json result payloads', () => {
		expect(
			toToolPreviewParts({
				result: JSON.stringify({
					images: [
						{
							image_url: 'https://cdn.openai.com/generated/stringified-panda',
							filename: 'stringified-panda.png',
						},
					],
				}),
			}),
		).toEqual([
			{
				type: 'image',
				url: 'https://cdn.openai.com/generated/stringified-panda',
				mimeType: undefined,
				name: 'stringified-panda.png',
				alt: 'stringified-panda.png',
			},
		]);
	});

	test('tool preview mapper supports camelCase base64 image payloads without explicit mime', () => {
		expect(
			toToolPreviewParts({
				images: [
					{
						b64Json:
							'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9sZrxh8AAAAASUVORK5CYII=',
						filename: 'camel-inline.png',
						type: 'image',
					},
				],
			}),
		).toEqual([
			{
				type: 'image',
				url: expect.stringMatching(/^data:image\/png;base64,/),
				mimeType: 'image/png',
				name: 'camel-inline.png',
				alt: 'camel-inline.png',
			},
		]);
	});

	test('tool preview mapper extracts inline preview parts from the fixed image generation output', () => {
		const fixture = getHostedToolFixture('image_generation');

		expect(toToolPreviewParts(fixture.output, fixture.toolName)).toEqual([
			{
				type: 'image',
				url: expect.stringMatching(/^data:image\/png;base64,/),
				mimeType: 'image/png',
				name: undefined,
				alt: 'Generated image',
			},
		]);
	});

	test('tool preview mapper keeps non-preview hosted tools dialog-only', () => {
		for (const fixture of HOSTED_TOOL_FIXTURES.filter((entry) => !entry.expectsPreviewParts)) {
			expect(
				toToolPreviewParts(fixture.output, fixture.toolName),
				`expected ${fixture.toolName} to stay dialog-only`,
			).toEqual([]);
		}
	});

	test('assistant text extraction preserves the prose part across hosted tool fixtures', () => {
		for (const fixture of HOSTED_TOOL_FIXTURES) {
			expect(extractAssistantText(fixture.streamedParts)).toBe(fixture.assistantText);
			const assistantParts = toAssistantMessageParts(fixture.streamedParts);
			expect(assistantParts[0]).toEqual({ type: 'text', text: fixture.assistantText });
			if (fixture.expectsPreviewParts) {
				expect(assistantParts[1]).toEqual({
					type: 'image',
					url: expect.stringMatching(/^data:image\/png;base64,/),
					mimeType: 'image/png',
					name: undefined,
					alt: 'Generated image',
				});
			} else {
				expect(assistantParts).toHaveLength(1);
			}
		}
	});
});
