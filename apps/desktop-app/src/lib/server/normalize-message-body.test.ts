import { describe, test, expect } from 'vitest';
import { normalizeMessageBody } from '$lib/server/chat-services';

describe('normalizeMessageBody', () => {
	test('legacy payload: extracts text from top-level field', () => {
		const result = normalizeMessageBody({ text: 'Hello world' });
		expect(result).toEqual({
			text: 'Hello world',
			parentMessageId: undefined,
			toolOverrides: undefined,
			attachments: undefined,
		});
	});

	test('legacy payload: preserves parentMessageId', () => {
		const result = normalizeMessageBody({
			text: 'Reply here',
			parentMessageId: 'msg-123',
		});
		expect(result.text).toBe('Reply here');
		expect(result.parentMessageId).toBe('msg-123');
	});

	test('legacy payload: preserves valid inline attachments', () => {
		const attachments = [
			{
				type: 'image',
				name: 'photo.png',
				mimeType: 'image/png',
				inlineDataBase64: 'iVBORw0KGgo=',
				size: 8,
				lastModified: '2026-04-15T22:15:54.000Z',
				status: 'pending',
				messageId: '',
			},
		];
		const result = normalizeMessageBody({
			text: 'See attached',
			attachments,
		});
		expect(result.attachments).toEqual(attachments);
	});

	test('AI SDK payload: extracts text from last user message parts', () => {
		const result = normalizeMessageBody({
			id: 'chat-1',
			messages: [
				{
					id: 'msg-1',
					role: 'user',
					parts: [{ type: 'text', text: 'What is 2+2?' }],
				},
			],
			trigger: 'submit-message',
			messageId: 'msg-1',
		});
		expect(result.text).toBe('What is 2+2?');
	});

	test('AI SDK payload: picks last user message from multi-turn history', () => {
		const result = normalizeMessageBody({
			id: 'chat-1',
			messages: [
				{
					id: 'msg-1',
					role: 'user',
					parts: [{ type: 'text', text: 'First question' }],
				},
				{
					id: 'msg-2',
					role: 'assistant',
					parts: [{ type: 'text', text: 'First answer' }],
				},
				{
					id: 'msg-3',
					role: 'user',
					parts: [{ type: 'text', text: 'Follow-up question' }],
				},
			],
			trigger: 'submit-message',
			messageId: 'msg-3',
		});
		expect(result.text).toBe('Follow-up question');
	});

	test('AI SDK payload: joins multiple text parts', () => {
		const result = normalizeMessageBody({
			messages: [
				{
					id: 'msg-1',
					role: 'user',
					parts: [
						{ type: 'text', text: 'Line one' },
						{ type: 'text', text: 'Line two' },
					],
				},
			],
		});
		expect(result.text).toBe('Line one\nLine two');
	});

	test('AI SDK payload: preserves parentMessageId from body extras', () => {
		const result = normalizeMessageBody({
			messages: [
				{
					id: 'msg-1',
					role: 'user',
					parts: [{ type: 'text', text: 'Reply' }],
				},
			],
			parentMessageId: 'parent-42',
		});
		expect(result.parentMessageId).toBe('parent-42');
	});

	test('AI SDK payload: preserves attachment extras including inline data', () => {
		const attachments = [
			{
				type: 'image',
				name: 'screenshot.png',
				mimeType: 'image/png',
				inlineDataBase64: 'iVBORw0KGgo=',
				size: 8,
				lastModified: '2026-04-15T22:15:54.000Z',
				status: 'pending',
				messageId: '',
			},
		];
		const result = normalizeMessageBody({
			messages: [
				{
					id: 'msg-1',
					role: 'user',
					parts: [{ type: 'text', text: 'Describe this screenshot' }],
				},
			],
			attachments,
		});

		expect(result.attachments).toEqual(attachments);
	});

	test('AI SDK payload: preserves boolean tool overrides from body extras', () => {
		const result = normalizeMessageBody({
			messages: [
				{
					id: 'msg-1',
					role: 'user',
					parts: [{ type: 'text', text: 'Search the web' }],
				},
			],
			toolOverrides: {
				web_search: true,
				file_search: false,
				ignored: 'yes',
			},
		});

		expect(result.toolOverrides).toEqual({
			web_search: true,
			file_search: false,
		});
	});

	test('AI SDK payload: ignores non-text parts', () => {
		const result = normalizeMessageBody({
			messages: [
				{
					id: 'msg-1',
					role: 'user',
					parts: [
						{ type: 'file', url: 'data:image/png;...' },
						{ type: 'text', text: 'Describe this image' },
					],
				},
			],
		});
		expect(result.text).toBe('Describe this image');
	});

	test('throws when body has no text and no messages', () => {
		expect(() => normalizeMessageBody({})).toThrow(
			'Request must include either a "text" field or a "messages" array.',
		);
	});

	test('throws when text is empty string', () => {
		expect(() => normalizeMessageBody({ text: '' })).toThrow(
			'Request must include either a "text" field or a "messages" array.',
		);
	});

	test('throws when messages array is empty', () => {
		expect(() => normalizeMessageBody({ messages: [] })).toThrow(
			'Request must include either a "text" field or a "messages" array.',
		);
	});

	test('throws when messages has no user message', () => {
		expect(() =>
			normalizeMessageBody({
				messages: [
					{ id: 'msg-1', role: 'assistant', parts: [{ type: 'text', text: 'Hi' }] },
				],
			}),
		).toThrow('No user message found in messages array.');
	});

	test('throws when user message has no text parts', () => {
		expect(() =>
			normalizeMessageBody({
				messages: [
					{ id: 'msg-1', role: 'user', parts: [{ type: 'file', url: 'data:...' }] },
				],
			}),
		).toThrow('User message has no text parts.');
	});

	test('throws when user message has empty parts array', () => {
		expect(() =>
			normalizeMessageBody({
				messages: [{ id: 'msg-1', role: 'user', parts: [] }],
			}),
		).toThrow('User message has no text parts.');
	});

	test('rejects attachments with a "path" field over HTTP', () => {
		expect(() =>
			normalizeMessageBody({
				text: 'See attached',
				attachments: [
					{
						type: 'image',
						name: 'leak.png',
						mimeType: 'image/png',
						path: '/etc/passwd',
						size: 0,
						lastModified: '2026-04-15T22:15:54.000Z',
						status: 'pending',
						messageId: '',
					},
				],
			}),
		).toThrow(/path/);
	});

	test('rejects attachments without inlineDataBase64', () => {
		expect(() =>
			normalizeMessageBody({
				text: 'See attached',
				attachments: [
					{
						type: 'image',
						name: 'photo.png',
						mimeType: 'image/png',
						size: 0,
						lastModified: '2026-04-15T22:15:54.000Z',
						status: 'pending',
						messageId: '',
					},
				],
			}),
		).toThrow(/inlineDataBase64/);
	});

	test('rejects attachments with an unknown type', () => {
		expect(() =>
			normalizeMessageBody({
				text: 'See attached',
				attachments: [
					{
						type: 'audio',
						name: 'sound.mp3',
						mimeType: 'audio/mpeg',
						inlineDataBase64: 'data',
						size: 0,
						lastModified: '2026-04-15T22:15:54.000Z',
						status: 'pending',
						messageId: '',
					},
				],
			}),
		).toThrow(/type/);
	});

	test('rejects attachment payloads larger than the per-attachment cap', () => {
		const huge = 'A'.repeat(45 * 1024 * 1024);
		expect(() =>
			normalizeMessageBody({
				text: 'See attached',
				attachments: [
					{
						type: 'image',
						name: 'big.png',
						mimeType: 'image/png',
						inlineDataBase64: huge,
						size: huge.length,
						lastModified: '2026-04-15T22:15:54.000Z',
						status: 'pending',
						messageId: '',
					},
				],
			}),
		).toThrow(/size limit/);
	});

	test('rejects attachment arrays larger than the per-message cap', () => {
		const attachments = Array.from({ length: 17 }, (_, index) => ({
			type: 'image',
			name: `photo-${index}.png`,
			mimeType: 'image/png',
			inlineDataBase64: 'iVBORw0KGgo=',
			size: 8,
			lastModified: '2026-04-15T22:15:54.000Z',
			status: 'pending',
			messageId: '',
		}));
		expect(() =>
			normalizeMessageBody({
				text: 'See attached',
				attachments,
			}),
		).toThrow(/per-message limit/);
	});
});
