import { describe, expect, test } from 'vitest';
import {
	HOSTED_TOOL_FIXTURES,
	ONE_PIXEL_PNG_BASE64,
	getHostedToolFixture,
} from '../../../../../packages/domain/src/application/chat/__test-helpers__/test-fixtures.js';
import type { ToolInvocationInfo } from './types.js';
import {
	getToolCode,
	getToolFiles,
	getToolLocationSummary,
	getToolPreviewUrl,
	getToolQuery,
	getToolSources,
	getToolUrl,
} from './tool-invocation-details.js';

function invocationFromFixture(toolName: typeof HOSTED_TOOL_FIXTURES[number]['toolName']): ToolInvocationInfo {
	const fixture = getHostedToolFixture(toolName);
	return {
		toolCallId: fixture.toolCallId,
		toolName: fixture.toolName,
		state: 'output-available',
		input: fixture.input,
		output: fixture.output,
		providerExecuted: true,
	};
}

describe('tool invocation details helpers', () => {
	test('image_generation preview decodes naked base64 via getToolAssetExtractionOptions', () => {
		const invocation = invocationFromFixture('image_generation');
		const previewUrl = getToolPreviewUrl(invocation);
		expect(previewUrl).toBeDefined();
		expect(previewUrl).toMatch(/^data:image\/png;base64,/);
		expect(previewUrl).toContain(ONE_PIXEL_PNG_BASE64);
	});

	test('image_generation preview falls back gracefully when the payload is an unknown string', () => {
		const invocation: ToolInvocationInfo = {
			toolCallId: 'tool-img-broken',
			toolName: 'image_generation',
			state: 'output-available',
			input: { prompt: 'x' },
			output: { result: 'not a base64 blob' },
			providerExecuted: true,
		};
		expect(getToolPreviewUrl(invocation)).toBeUndefined();
	});

	test('non-image tools never infer a preview URL from arbitrary output', () => {
		const invocation = invocationFromFixture('web_search');
		expect(getToolPreviewUrl(invocation)).toBeUndefined();
	});

	test('web_search exposes query from input and sources from output.results', () => {
		const invocation = invocationFromFixture('web_search');
		expect(getToolQuery(invocation)).toBe('current usd brl exchange rate');
		expect(getToolSources(invocation)).toEqual([
			{
				title: 'Wise exchange rate',
				url: 'https://wise.com',
				snippet: 'USD to BRL market rate overview.',
			},
		]);
		expect(getToolFiles(invocation)).toEqual([]);
		expect(getToolUrl(invocation)).toBeUndefined();
	});

	test('google_search mirrors web_search for query and sources', () => {
		const invocation = invocationFromFixture('google_search');
		expect(getToolQuery(invocation)).toBe('best coffee near paulista avenue');
		expect(getToolSources(invocation)).toEqual([
			{
				title: 'Top cafes on Paulista Avenue',
				url: 'https://example.com/cafes',
				snippet: 'A local roundup of popular cafes.',
			},
		]);
	});

	test('file_search promotes matches to files with filename fallback', () => {
		const invocation = invocationFromFixture('file_search');
		expect(getToolQuery(invocation)).toBe('quarterly revenue summary');
		expect(getToolFiles(invocation)).toEqual([
			{ name: 'revenue-summary-q1.pdf', url: undefined },
		]);
	});

	test('web_fetch uses the input url for getToolUrl and the query fallback', () => {
		const invocation = invocationFromFixture('web_fetch');
		expect(getToolUrl(invocation)).toBe('https://example.com/docs/ai-sdk');
		expect(getToolQuery(invocation)).toBe('https://example.com/docs/ai-sdk');
		expect(getToolFiles(invocation)).toEqual([]);
	});

	test('url_context resolves the same as web_fetch for url-bearing payloads', () => {
		const invocation = invocationFromFixture('url_context');
		expect(getToolUrl(invocation)).toBe('https://example.com/docs/ai-sdk');
		expect(getToolQuery(invocation)).toBe('https://example.com/docs/ai-sdk');
	});

	test('google_maps surfaces location and summarizes the first place as a source', () => {
		const invocation = invocationFromFixture('google_maps');
		expect(getToolLocationSummary(invocation)).toBe('Sao Paulo Museum of Art');
		expect(getToolQuery(invocation)).toBe('Sao Paulo Museum of Art');
		expect(getToolSources(invocation)).toEqual([
			{
				title: 'Sao Paulo Museum of Art',
				url: undefined,
				snippet: 'Avenida Paulista, 1578 - Bela Vista, Sao Paulo',
			},
		]);
	});

	test('code_execution exposes the input code and does not collect the stdout as a file', () => {
		const invocation = invocationFromFixture('code_execution');
		expect(getToolCode(invocation)).toBe('print(6 * 7)');
		expect(getToolFiles(invocation)).toEqual([]);
	});

	test('code_interpreter exposes artifacts via getToolFiles while keeping getToolCode on input', () => {
		const invocation = invocationFromFixture('code_interpreter');
		expect(getToolCode(invocation)).toBe('import pandas as pd\nprint(df.describe())');
		expect(getToolFiles(invocation)).toEqual([
			{ name: 'summary.csv', url: undefined },
		]);
	});

	test('all hosted tool fixtures produce at least one populated detail section', () => {
		for (const fixture of HOSTED_TOOL_FIXTURES) {
			const invocation = invocationFromFixture(fixture.toolName);
			const hasQuery = Boolean(getToolQuery(invocation));
			const hasUrl = Boolean(getToolUrl(invocation));
			const hasSources = getToolSources(invocation).length > 0;
			const hasFiles = getToolFiles(invocation).length > 0;
			const hasCode = Boolean(getToolCode(invocation));
			const hasLocation = Boolean(getToolLocationSummary(invocation));
			const hasPreview = Boolean(getToolPreviewUrl(invocation));

			expect(
				hasQuery || hasUrl || hasSources || hasFiles || hasCode || hasLocation || hasPreview,
				`expected at least one populated section for ${fixture.toolName}`,
			).toBe(true);
		}
	});
});
