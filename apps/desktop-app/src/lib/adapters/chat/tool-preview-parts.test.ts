import { describe, expect, test } from 'vitest';
import { getRenderedAssistantParts, getToolPreviewParts } from './tool-preview-parts';
import {
	HOSTED_TOOL_FIXTURES,
	getHostedToolFixture,
} from '../../../../../../packages/domain/src/application/chat/__test-helpers__/test-fixtures';

describe('tool preview parts', () => {
	test('merges assistant prose with previewable image generation output', () => {
		const fixture = getHostedToolFixture('image_generation');
		const assistantParts = [{ type: 'text' as const, text: fixture.assistantText }];
		const toolParts = [{ output: fixture.output, toolName: fixture.toolName }];

		expect(getToolPreviewParts(toolParts, assistantParts)).toEqual([
			{
				type: 'image',
				url: expect.stringMatching(/^data:image\/png;base64,/),
				mimeType: 'image/png',
				name: undefined,
				alt: 'Generated image',
			},
		]);

		expect(getRenderedAssistantParts(assistantParts, toolParts)).toEqual([
			{ type: 'text', text: fixture.assistantText },
			{
				type: 'image',
				url: expect.stringMatching(/^data:image\/png;base64,/),
				mimeType: 'image/png',
				name: undefined,
				alt: 'Generated image',
			},
		]);
	});

	test('keeps non-preview hosted tools dialog-only at the page composition boundary', () => {
		for (const fixture of HOSTED_TOOL_FIXTURES.filter((entry) => !entry.expectsPreviewParts)) {
			const assistantParts = [{ type: 'text' as const, text: fixture.assistantText }];
			const toolParts = [{ output: fixture.output, toolName: fixture.toolName }];

			expect(
				getToolPreviewParts(toolParts, assistantParts),
				`expected ${fixture.toolName} to avoid inline preview parts`,
			).toEqual([]);

			expect(getRenderedAssistantParts(assistantParts, toolParts)).toEqual([
				{ type: 'text', text: fixture.assistantText },
			]);
		}
	});

	test('does not append tool previews when assistant parts already contain structured content', () => {
		const fixture = getHostedToolFixture('image_generation');
		const assistantParts = [
			{ type: 'text' as const, text: fixture.assistantText },
			{
				type: 'image' as const,
				url: 'https://example.com/existing-preview.png',
				name: 'existing-preview.png',
				alt: 'existing-preview.png',
			},
		];

		expect(getToolPreviewParts([{ output: fixture.output, toolName: fixture.toolName }], assistantParts)).toEqual([]);
		expect(getRenderedAssistantParts(assistantParts, [{ output: fixture.output, toolName: fixture.toolName }])).toEqual(
			assistantParts,
		);
	});

	test('returns preview-only assistant parts when the tool is the only visible output', () => {
		const fixture = getHostedToolFixture('image_generation');

		expect(getRenderedAssistantParts([], [{ output: fixture.output, toolName: fixture.toolName }])).toEqual([
			{
				type: 'image',
				url: expect.stringMatching(/^data:image\/png;base64,/),
				mimeType: 'image/png',
				name: undefined,
				alt: 'Generated image',
			},
		]);
	});
});
