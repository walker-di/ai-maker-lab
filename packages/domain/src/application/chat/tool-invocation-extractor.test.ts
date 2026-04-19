import { describe, expect, test } from 'bun:test';
import type { ModelMessage } from 'ai';
import {
	extractToolInvocationsFromParts,
	extractToolInvocationsFromResponseMessages,
} from './tool-invocation-extractor.js';
import {
	HOSTED_TOOL_FIXTURES,
	getHostedToolFixture,
} from './__test-helpers__/test-fixtures.js';

describe('extractToolInvocationsFromResponseMessages', () => {
	test('combines tool-call and tool-result parts into one invocation', () => {
		const messages = [
			{
				role: 'assistant',
				content: [
					{ type: 'text', text: 'Let me search.' },
					{
						type: 'tool-call',
						toolCallId: 'call-1',
						toolName: 'web_search',
						args: { query: 'current dollar real rate' },
					},
					{
						type: 'tool-result',
						toolCallId: 'call-1',
						toolName: 'web_search',
						result: {
							results: [{ title: 'Wise', url: 'https://wise.com' }],
						},
					},
				],
			},
		] as unknown as ModelMessage[];

		expect(extractToolInvocationsFromResponseMessages(messages)).toEqual([
			{
				toolCallId: 'call-1',
				toolName: 'web_search',
				state: 'output-available',
				input: { query: 'current dollar real rate' },
				output: { results: [{ title: 'Wise', url: 'https://wise.com' }] },
				errorText: undefined,
				providerExecuted: undefined,
			},
		]);
	});

	test('normalizes ui-style tool parts and output errors', () => {
		const messages = [
			{
				role: 'assistant',
				content: [
					{
						type: 'tool-image_generation',
						toolCallId: 'call-2',
						state: 'output-available',
						input: { prompt: 'dark dashboard hero image' },
						output: { url: 'https://example.com/image.png' },
						providerExecuted: true,
					},
					{
						type: 'tool-code_execution',
						toolCallId: 'call-3',
						state: 'output-error',
						input: { code: 'print(1/0)' },
						errorText: 'division by zero',
					},
				],
			},
		] as unknown as ModelMessage[];

		expect(extractToolInvocationsFromResponseMessages(messages)).toEqual([
			{
				toolCallId: 'call-2',
				toolName: 'image_generation',
				state: 'output-available',
				input: { prompt: 'dark dashboard hero image' },
				output: { url: 'https://example.com/image.png' },
				errorText: undefined,
				providerExecuted: true,
			},
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

	test('extracts dynamic ui tool parts from streamed response messages', () => {
		expect(
			extractToolInvocationsFromParts([
				{
					type: 'dynamic-tool',
					toolCallId: 'call-4',
					toolName: 'web_search',
					state: 'output-available',
					input: { query: 'usd brl today' },
					output: { results: [{ title: 'Wise' }] },
				},
				{
					type: 'tool',
					toolCallId: 'call-5',
					toolName: 'code_execution',
					state: 'error',
					input: { code: 'print(1/0)' },
					errorText: 'division by zero',
				},
			]),
		).toEqual([
			{
				toolCallId: 'call-4',
				toolName: 'web_search',
				state: 'output-available',
				input: { query: 'usd brl today' },
				output: { results: [{ title: 'Wise' }] },
				errorText: undefined,
				providerExecuted: undefined,
			},
			{
				toolCallId: 'call-5',
				toolName: 'code_execution',
				state: 'error',
				input: { code: 'print(1/0)' },
				output: undefined,
				errorText: 'division by zero',
				providerExecuted: undefined,
			},
		]);
	});

	test('extracts provider-executed OpenAI web search parts from persisted response parts', () => {
		expect(
			extractToolInvocationsFromParts([
				{ type: 'step-start' },
				{
					type: 'tool-web_search',
					toolCallId: 'ws_live_1',
					state: 'output-available',
					providerExecuted: true,
					output: {
						sources: [{ title: 'Wise', url: 'https://wise.com' }],
					},
				},
				{ type: 'text', text: 'Current rate found.' },
			]),
		).toEqual([
			{
				toolCallId: 'ws_live_1',
				toolName: 'web_search',
				state: 'output-available',
				input: undefined,
				output: {
					sources: [{ title: 'Wise', url: 'https://wise.com' }],
				},
				errorText: undefined,
				providerExecuted: true,
			},
		]);
	});

	test('prefers rich provider results when ui output is empty', () => {
		expect(
			extractToolInvocationsFromParts([
				{
					type: 'tool-image_generation',
					toolCallId: 'ig_live_1',
					state: 'output-available',
					output: {},
					result: {
						images: [{ image_url: 'https://cdn.openai.com/generated/persisted-preview' }],
					},
					providerExecuted: true,
				},
			]),
		).toEqual([
			{
				toolCallId: 'ig_live_1',
				toolName: 'image_generation',
				state: 'output-available',
				input: undefined,
				output: {
					images: [{ image_url: 'https://cdn.openai.com/generated/persisted-preview' }],
				},
				errorText: undefined,
				providerExecuted: true,
			},
		]);
	});

	test('extracts all currently available hosted tools from streamed ui parts', () => {
		for (const fixture of HOSTED_TOOL_FIXTURES) {
			expect(
				extractToolInvocationsFromParts(fixture.streamedParts),
				`expected ${fixture.toolName} to extract from streamed parts`,
			).toEqual([
				{
					toolCallId: fixture.toolCallId,
					toolName: fixture.toolName,
					state: 'output-available',
					input: fixture.input,
					output: fixture.output,
					errorText: undefined,
					providerExecuted: fixture.toolName === 'file_search' ? undefined : true,
				},
			]);
		}
	});

	test('extracts all currently available hosted tools from response messages', () => {
		for (const fixture of HOSTED_TOOL_FIXTURES) {
			expect(
				extractToolInvocationsFromResponseMessages(fixture.responseMessages),
				`expected ${fixture.toolName} to extract from response messages`,
			).toEqual([
				{
					toolCallId: fixture.toolCallId,
					toolName: fixture.toolName,
					state: 'output-available',
					input: fixture.input,
					output: fixture.output,
					errorText: undefined,
					providerExecuted: fixture.toolName === 'file_search' ? undefined : true,
				},
			]);
		}
	});

	test('merges tool-call and tool-result parts across multiple response messages', () => {
		const fixture = getHostedToolFixture('web_search');

		const messages = [
			{
				role: 'assistant',
				content: [
					{ type: 'text', text: fixture.assistantText },
					{
						type: 'tool-call',
						toolCallId: fixture.toolCallId,
						toolName: fixture.toolName,
						args: fixture.input,
					},
				],
			},
			{
				role: 'tool',
				content: [
					{
						type: 'tool-result',
						toolCallId: fixture.toolCallId,
						toolName: fixture.toolName,
						result: fixture.output,
					},
				],
			},
		] as unknown as ModelMessage[];

		expect(extractToolInvocationsFromResponseMessages(messages)).toEqual([
			{
				toolCallId: fixture.toolCallId,
				toolName: fixture.toolName,
				state: 'output-available',
				input: fixture.input,
				output: fixture.output,
				errorText: undefined,
				providerExecuted: undefined,
			},
		]);
	});

	test('preserves input-streaming state for in-flight tool calls with only partial input', () => {
		expect(
			extractToolInvocationsFromParts([
				{
					type: 'tool-web_search',
					toolCallId: 'call-streaming',
					state: 'input-streaming',
					input: { query: 'curr' },
				},
			]),
		).toEqual([
			{
				toolCallId: 'call-streaming',
				toolName: 'web_search',
				state: 'input-streaming',
				input: { query: 'curr' },
				output: undefined,
				errorText: undefined,
				providerExecuted: undefined,
			},
		]);
	});

	test('preserves approval-responded state when a previously approved call returns output', () => {
		expect(
			extractToolInvocationsFromParts([
				{
					type: 'tool-web_fetch',
					toolCallId: 'call-approved',
					state: 'approval-responded',
					input: { url: 'https://example.com/allowed' },
					output: { url: 'https://example.com/allowed', summary: 'It is allowed.' },
					providerExecuted: true,
				},
			]),
		).toEqual([
			{
				toolCallId: 'call-approved',
				toolName: 'web_fetch',
				state: 'approval-responded',
				input: { url: 'https://example.com/allowed' },
				output: { url: 'https://example.com/allowed', summary: 'It is allowed.' },
				errorText: undefined,
				providerExecuted: true,
			},
		]);
	});

	test('normalizes output errors from result payloads and approval states', () => {
		expect(
			extractToolInvocationsFromParts([
				{
					type: 'tool-code_execution',
					toolCallId: 'call-error',
					state: 'output-error',
					input: { code: 'raise ZeroDivisionError()' },
					errorText: 'division by zero',
				},
				{
					type: 'tool-web_fetch',
					toolCallId: 'call-approval',
					state: 'approval-requested',
					input: { url: 'https://example.com/private' },
				},
				{
					type: 'tool-code_interpreter',
					toolCallId: 'call-result-error',
					input: { code: '1/0' },
					isError: true,
					result: 'division by zero',
				},
			]),
		).toEqual([
			{
				toolCallId: 'call-error',
				toolName: 'code_execution',
				state: 'error',
				input: { code: 'raise ZeroDivisionError()' },
				output: undefined,
				errorText: 'division by zero',
				providerExecuted: undefined,
			},
			{
				toolCallId: 'call-approval',
				toolName: 'web_fetch',
				state: 'approval-requested',
				input: { url: 'https://example.com/private' },
				output: undefined,
				errorText: undefined,
				providerExecuted: undefined,
			},
			{
				toolCallId: 'call-result-error',
				toolName: 'code_interpreter',
				state: 'error',
				input: { code: '1/0' },
				output: 'division by zero',
				errorText: 'division by zero',
				providerExecuted: undefined,
			},
		]);
	});
});
