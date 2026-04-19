import { describe, expect, test } from 'vitest';
import { getAssistantPreviewImageUrl, getToolAssetExtractionOptions } from 'ui/source/chat/headless';
import {
	ONE_PIXEL_PNG_BASE64,
} from '../../../../../../packages/domain/src/application/chat/__test-helpers__/test-fixtures';
import {
	toPersistedToolInvocationInfos,
	toToolInvocationInfo,
	toToolInvocationInfos,
} from './tool-invocation-view-model';

describe('tool-invocation-view-model', () => {
	test('maps streamed tool parts into shared ui invocations', () => {
		expect(
			toToolInvocationInfo({
				type: 'tool-web_search',
				toolCallId: 'call-1',
				state: 'output-available',
				input: { query: 'current dollar real rate' },
				output: { results: [{ title: 'Wise' }] },
				providerExecuted: true,
			}),
		).toEqual({
			toolCallId: 'call-1',
			toolName: 'web_search',
			state: 'output-available',
			input: { query: 'current dollar real rate' },
			output: { results: [{ title: 'Wise' }] },
			errorText: undefined,
			providerExecuted: true,
		});
	});

	test('filters non-tool parts from streamed messages', () => {
		expect(
			toToolInvocationInfos([
				{ type: 'text', text: 'hello' },
				{
					type: 'tool-image_generation',
					toolCallId: 'call-2',
					state: 'input-available',
					input: { prompt: 'generate mockup' },
				},
			]),
		).toHaveLength(1);
	});

	test('normalizes empty output objects so preview logic can use rich results', () => {
		const invocation = toToolInvocationInfo({
			type: 'tool-image_generation',
			toolCallId: 'call-ig',
			state: 'output-available',
			input: { prompt: 'pls create a panda image' },
			output: {},
			result: {
				images: [
					{
						image_url: 'https://cdn.openai.com/generated/panda',
						mime_type: 'image/png',
					},
				],
			},
			providerExecuted: true,
		});

		expect(invocation).toEqual({
			toolCallId: 'call-ig',
			toolName: 'image_generation',
			state: 'output-available',
			input: { prompt: 'pls create a panda image' },
			output: {
				images: [
					{
						image_url: 'https://cdn.openai.com/generated/panda',
						mime_type: 'image/png',
					},
				],
			},
			errorText: undefined,
			providerExecuted: true,
		});

		expect(getAssistantPreviewImageUrl(invocation?.output)).toBe(
			'https://cdn.openai.com/generated/panda',
		);
	});

	test('merges provider result into partial output objects', () => {
		const invocation = toToolInvocationInfo({
			type: 'tool-image_generation',
			toolCallId: 'call-merge',
			state: 'output-available',
			output: { status: 'completed', result: {} },
			result: {
				images: [
					{
						image_url: 'https://cdn.openai.com/generated/merge-test',
					},
				],
			},
		});

		expect(invocation?.output).toEqual({
			status: 'completed',
			result: {
				images: [
					{
						image_url: 'https://cdn.openai.com/generated/merge-test',
					},
				],
			},
		});
		expect(getAssistantPreviewImageUrl(invocation?.output)).toBe(
			'https://cdn.openai.com/generated/merge-test',
		);
	});

	test('maps persisted domain invocations into ui invocations', () => {
		expect(
			toPersistedToolInvocationInfos([
				{
					toolCallId: 'call-3',
					toolName: 'code_execution',
					state: 'error',
					input: { code: 'print(1/0)' },
					errorText: 'division by zero',
				},
			]),
		).toEqual([
			{
				toolCallId: 'call-3',
				toolName: 'code_execution',
				state: 'error',
				input: { code: 'print(1/0)' },
				output: undefined,
				errorText: 'division by zero',
				providerExecuted: undefined,
			},
		]);
	});

	test('preserves naked base64 persisted image_generation result and keeps preview inference working', () => {
		const [invocation] = toPersistedToolInvocationInfos([
			{
				toolCallId: 'call-ig-base64',
				toolName: 'image_generation',
				state: 'output-available',
				input: { prompt: 'pls create a panda image' },
				output: {
					result: ONE_PIXEL_PNG_BASE64,
				},
				providerExecuted: true,
			},
		]);

		expect(invocation).toEqual({
			toolCallId: 'call-ig-base64',
			toolName: 'image_generation',
			state: 'output-available',
			input: { prompt: 'pls create a panda image' },
			output: {
				result: ONE_PIXEL_PNG_BASE64,
			},
			errorText: undefined,
			providerExecuted: true,
		});

		expect(
			getAssistantPreviewImageUrl(
				invocation.output,
				getToolAssetExtractionOptions(invocation.toolName),
			),
		).toMatch(/^data:image\/png;base64,/);
	});

	test('maps streamed input-streaming parts to the same state for live progress UI', () => {
		expect(
			toToolInvocationInfo({
				type: 'tool-web_search',
				toolCallId: 'call-stream',
				state: 'input-streaming',
				input: { query: 'curr' },
			}),
		).toEqual({
			toolCallId: 'call-stream',
			toolName: 'web_search',
			state: 'input-streaming',
			input: { query: 'curr' },
			output: undefined,
			errorText: undefined,
			providerExecuted: undefined,
		});
	});

	test('maps persisted approval-responded invocations so UI can render approved hosted calls', () => {
		expect(
			toPersistedToolInvocationInfos([
				{
					toolCallId: 'call-approved',
					toolName: 'web_fetch',
					state: 'approval-responded',
					input: { url: 'https://example.com/allowed' },
					output: { url: 'https://example.com/allowed', summary: 'ok' },
					providerExecuted: true,
				},
			]),
		).toEqual([
			{
				toolCallId: 'call-approved',
				toolName: 'web_fetch',
				state: 'approval-responded',
				input: { url: 'https://example.com/allowed' },
				output: { url: 'https://example.com/allowed', summary: 'ok' },
				errorText: undefined,
				providerExecuted: true,
			},
		]);
	});

	test('maps persisted error-state invocations with no output and an error message', () => {
		expect(
			toPersistedToolInvocationInfos([
				{
					toolCallId: 'call-ig-error',
					toolName: 'image_generation',
					state: 'error',
					input: { prompt: 'draw infeasible shape' },
					errorText: 'Image generation failed: policy violation.',
				},
			]),
		).toEqual([
			{
				toolCallId: 'call-ig-error',
				toolName: 'image_generation',
				state: 'error',
				input: { prompt: 'draw infeasible shape' },
				output: undefined,
				errorText: 'Image generation failed: policy violation.',
				providerExecuted: undefined,
			},
		]);
	});

	test('normalizes stringified persisted output results for readable dialogs', () => {
		expect(
			toPersistedToolInvocationInfos([
				{
					toolCallId: 'call-ig-persisted',
					toolName: 'image_generation',
					state: 'output-available',
					input: { prompt: 'pls create a panda image' },
					output: {
						result: JSON.stringify({
							images: [
								{
									image_url: 'https://cdn.openai.com/generated/panda',
								},
							],
						}),
					},
				},
			]),
		).toEqual([
			{
				toolCallId: 'call-ig-persisted',
				toolName: 'image_generation',
				state: 'output-available',
				input: { prompt: 'pls create a panda image' },
				output: {
					result: {
						images: [
							{
								image_url: 'https://cdn.openai.com/generated/panda',
							},
						],
					},
				},
				errorText: undefined,
				providerExecuted: undefined,
			},
		]);
	});
});
