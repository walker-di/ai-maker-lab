import { describe, expect, test } from 'vitest';
import { ONE_PIXEL_PNG_BASE64 } from '../../../../../packages/domain/src/application/chat/__test-helpers__/test-fixtures.js';
import {
	formatToolInvocationDisplayValue,
	formatToolInvocationForDisplay,
	normalizeToolInvocationDisplayValue,
} from './tool-invocation-display.js';

describe('tool invocation display helpers', () => {
	test('summarizes naked base64 image_generation output.result instead of dumping raw bytes', () => {
		const formatted = formatToolInvocationDisplayValue(
			{ result: ONE_PIXEL_PNG_BASE64 },
			{ toolName: 'image_generation' },
		);

		const expectedLabel = `[image/png base64 payload omitted (${ONE_PIXEL_PNG_BASE64.length} chars)]`;
		expect(formatted).toContain(expectedLabel);
		expect(formatted).not.toContain(ONE_PIXEL_PNG_BASE64);
	});

	test('summarizes data URL image_generation payloads using the embedded mime type and encoded length', () => {
		const dataUrl = `data:image/webp;base64,${ONE_PIXEL_PNG_BASE64}`;
		const formatted = formatToolInvocationDisplayValue(
			{ result: dataUrl },
			{ toolName: 'image_generation' },
		);

		expect(formatted).toContain(
			`[image/webp base64 payload omitted (${ONE_PIXEL_PNG_BASE64.length} chars)]`,
		);
		expect(formatted).not.toContain(dataUrl);
	});

	test('does not summarize non-image tools so logs remain faithful for other providers', () => {
		const payload = { result: ONE_PIXEL_PNG_BASE64 };
		const formatted = formatToolInvocationDisplayValue(payload, { toolName: 'web_search' });

		expect(formatted).toContain(ONE_PIXEL_PNG_BASE64);
		expect(formatted).not.toMatch(/base64 payload omitted/);
	});

	test('parses stringified JSON output.result into readable structured JSON', () => {
		const structured = {
			results: [
				{ title: 'Wise', url: 'https://wise.com' },
				{ title: 'XE', url: 'https://xe.com' },
			],
		};
		const formatted = formatToolInvocationDisplayValue(
			{ result: JSON.stringify(structured) },
			{ toolName: 'web_search' },
		);

		expect(formatted).toContain('"title": "Wise"');
		expect(formatted).toContain('"url": "https://xe.com"');
		expect(formatted).not.toMatch(/\\"title\\"/);
	});

	test('normalizes bigints to their string form so JSON.stringify never throws', () => {
		const formatted = formatToolInvocationDisplayValue({ count: 9007199254740993n });
		expect(formatted).toContain('"count": "9007199254740993"');
	});

	test('replaces circular references with [Circular] sentinels', () => {
		const node: Record<string, unknown> = { label: 'root' };
		node.self = node;

		const normalized = normalizeToolInvocationDisplayValue(node) as Record<string, unknown>;
		expect(normalized).toEqual({ label: 'root', self: '[Circular]' });

		const formatted = formatToolInvocationDisplayValue(node);
		expect(formatted).toContain('"self": "[Circular]"');
	});

	test('caps deeply nested payloads with a [MaxDepth] sentinel instead of recursing forever', () => {
		type Deep = { next?: Deep };
		const root: Deep = {};
		let cursor: Deep = root;
		for (let i = 0; i < 12; i++) {
			cursor.next = {};
			cursor = cursor.next;
		}

		const formatted = formatToolInvocationDisplayValue(root);
		expect(formatted).toContain('[MaxDepth]');
	});

	test('formatToolInvocationForDisplay propagates toolName context into input and output summaries', () => {
		const formatted = formatToolInvocationForDisplay({
			toolCallId: 'call-ig',
			toolName: 'image_generation',
			state: 'output-available',
			input: { prompt: 'pls create a panda image' },
			output: { result: ONE_PIXEL_PNG_BASE64 },
			providerExecuted: true,
		});

		expect(formatted).toContain('"toolName": "image_generation"');
		expect(formatted).toContain(
			`[image/png base64 payload omitted (${ONE_PIXEL_PNG_BASE64.length} chars)]`,
		);
		expect(formatted).not.toContain(ONE_PIXEL_PNG_BASE64);
	});
});
