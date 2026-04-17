import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWebChatTransport } from '$lib/adapters/chat/web-chat-transport';
import type { ChatTransport } from '$lib/adapters/chat/ChatTransport';
import type { ChatMessage, ChatSubthread } from 'domain/shared';

function makeChatMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
	return {
		id: overrides.id ?? 'msg-1',
		threadId: overrides.threadId ?? 'thread-1',
		role: overrides.role ?? 'user',
		content: overrides.content ?? 'Hello',
		attachments: overrides.attachments ?? [],
		toolInvocations: overrides.toolInvocations ?? [],
		createdAt: overrides.createdAt ?? '2026-04-16T00:00:00.000Z',
		...overrides,
	} satisfies ChatMessage;
}

const mockFetch = vi.fn<typeof fetch>();

describe('createWebChatTransport', () => {
	let transport: ChatTransport;
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		globalThis.fetch = mockFetch;
		transport = createWebChatTransport();
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	function okJson(data: unknown): Response {
		return new Response(JSON.stringify(data), {
			status: 200,
			headers: { 'content-type': 'application/json' },
		});
	}

	function errorJson(status: number, message: string): Response {
		return new Response(JSON.stringify({ error: message }), {
			status,
			headers: { 'content-type': 'application/json' },
		});
	}

	test('listAgents calls GET /api/chat/agents', async () => {
		const agents = [{ id: 'agent-1', name: 'Agent 1' }];
		mockFetch.mockResolvedValue(okJson(agents));

		const result = await transport.listAgents();

		expect(mockFetch).toHaveBeenCalledWith('/api/chat/agents');
		expect(result).toEqual(agents);
	});

	test('listThreads calls GET /api/chat/threads', async () => {
		const threads = [{ id: 'thread-1', title: 'Thread 1' }];
		mockFetch.mockResolvedValue(okJson(threads));

		const result = await transport.listThreads();

		expect(mockFetch).toHaveBeenCalledWith('/api/chat/threads');
		expect(result).toEqual(threads);
	});

	test('createThread calls POST /api/chat/threads', async () => {
		const input = { title: 'New Thread', participantIds: ['agent-1'] as readonly string[] };
		const created = { id: 'thread-new', title: 'New Thread' };
		mockFetch.mockResolvedValue(okJson(created));

		const result = await transport.createThread(input);

		expect(mockFetch).toHaveBeenCalledWith('/api/chat/threads', expect.objectContaining({
			method: 'POST',
			body: JSON.stringify(input),
		}));
		expect(result).toEqual(created);
	});

	test('getThread returns null on 404', async () => {
		mockFetch.mockResolvedValue(new Response(null, { status: 404 }));

		const result = await transport.getThread('missing');

		expect(result).toBeNull();
	});

	test('getThread returns thread on success', async () => {
		const thread = { id: 'thread-1', title: 'Found' };
		mockFetch.mockResolvedValue(okJson(thread));

		const result = await transport.getThread('thread-1');

		expect(result).toEqual(thread);
	});

	test('updateThreadTitle calls PATCH /api/chat/threads/:id', async () => {
		const updated = { id: 'thread-1', title: 'Renamed thread' };
		mockFetch.mockResolvedValue(okJson(updated));

		const result = await transport.updateThreadTitle('thread-1', 'Renamed thread');

		expect(mockFetch).toHaveBeenCalledWith('/api/chat/threads/thread-1', expect.objectContaining({
			method: 'PATCH',
			body: JSON.stringify({ title: 'Renamed thread' }),
		}));
		expect(result).toEqual(updated);
	});

	test('deleteThread calls DELETE', async () => {
		mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

		await transport.deleteThread('thread-1');

		expect(mockFetch).toHaveBeenCalledWith('/api/chat/threads/thread-1', { method: 'DELETE' });
	});

	test('deleteThread throws on error', async () => {
		mockFetch.mockResolvedValue(errorJson(500, 'Server error'));

		await expect(transport.deleteThread('thread-1')).rejects.toThrow('Server error');
	});

	test('setThreadAgent calls PATCH /api/chat/threads/:id', async () => {
		const updated = { id: 'thread-1', title: 'Thread', defaultAgentId: 'agent-2' };
		mockFetch.mockResolvedValue(okJson(updated));

		const result = await transport.setThreadAgent('thread-1', 'agent-2');

		expect(mockFetch).toHaveBeenCalledWith('/api/chat/threads/thread-1', expect.objectContaining({
			method: 'PATCH',
			body: JSON.stringify({ defaultAgentId: 'agent-2' }),
		}));
		expect(result).toEqual(updated);
	});

	test('addThreadParticipant calls PATCH /api/chat/threads/:id', async () => {
		const updated = { id: 'thread-1', participantIds: ['a-1', 'a-2'] };
		mockFetch.mockResolvedValue(okJson(updated));

		const result = await transport.addThreadParticipant('thread-1', 'a-2');

		expect(mockFetch).toHaveBeenCalledWith('/api/chat/threads/thread-1', expect.objectContaining({
			method: 'PATCH',
			body: JSON.stringify({ addParticipantId: 'a-2' }),
		}));
		expect(result).toEqual(updated);
	});

	test('removeThreadParticipant calls PATCH /api/chat/threads/:id', async () => {
		const updated = { id: 'thread-1', participantIds: ['a-1'] };
		mockFetch.mockResolvedValue(okJson(updated));

		const result = await transport.removeThreadParticipant('thread-1', 'a-2');

		expect(mockFetch).toHaveBeenCalledWith('/api/chat/threads/thread-1', expect.objectContaining({
			method: 'PATCH',
			body: JSON.stringify({ removeParticipantId: 'a-2' }),
		}));
		expect(result).toEqual(updated);
	});

	test('getMessages returns full ChatMessage shapes (attachments, toolInvocations, parts)', async () => {
		const messages: ChatMessage[] = [
			makeChatMessage({
				id: 'msg-1',
				role: 'user',
				content: 'Please summarize',
				attachments: [
					{
						id: 'att-1',
						messageId: 'msg-1',
						type: 'text',
						name: 'notes.txt',
						mimeType: 'text/plain',
						path: '/tmp/notes.txt',
						size: 128,
						lastModified: '2026-04-16T00:00:00.000Z',
						status: 'ready',
					},
				],
			}),
			makeChatMessage({
				id: 'msg-2',
				role: 'assistant',
				content: 'Sure — here is the summary.',
				agentId: 'system-general',
				chatRunId: 'run-1',
				toolInvocations: [
					{
						toolCallId: 'call-1',
						toolName: 'web_search',
						state: 'output-available',
						input: { query: 'latest launches' },
						output: { results: [{ title: 'SpaceX launches', url: 'https://example.com' }] },
						providerExecuted: true,
					},
				],
			}),
		];
		mockFetch.mockResolvedValue(okJson(messages));

		const result = await transport.getMessages('thread-1');

		expect(mockFetch).toHaveBeenCalledWith('/api/chat/threads/thread-1/messages');
		expect(result).toEqual(messages);
		expect(result[0].attachments[0].type).toBe('text');
		expect(result[1].toolInvocations[0].state).toBe('output-available');
	});

	test('getSubthread returns parent + replies with full ChatMessage shapes', async () => {
		const parentMessage = makeChatMessage({
			id: 'msg-parent',
			role: 'user',
			content: 'Open question',
		});
		const replies: ChatMessage[] = [
			makeChatMessage({
				id: 'reply-1',
				role: 'assistant',
				content: 'One perspective…',
				agentId: 'system-creative',
				parentMessageId: 'msg-parent',
			}),
			makeChatMessage({
				id: 'reply-2',
				role: 'user',
				content: 'Follow-up',
				parentMessageId: 'msg-parent',
			}),
		];
		const subthread: ChatSubthread = { parentMessage, replies };
		mockFetch.mockResolvedValue(okJson(subthread));

		const result = await transport.getSubthread('thread-1', 'msg-parent');

		expect(mockFetch).toHaveBeenCalledWith('/api/chat/threads/thread-1/subthreads/msg-parent');
		expect(result).toEqual(subthread);
		expect(result.parentMessage.id).toBe('msg-parent');
		expect(result.replies.map((reply) => reply.id)).toEqual(['reply-1', 'reply-2']);
		expect(result.replies.every((reply) => reply.parentMessageId === 'msg-parent')).toBe(true);
	});

	test('getSubthread rejects when the backend returns 404', async () => {
		mockFetch.mockResolvedValue(errorJson(404, 'Subthread not found'));

		await expect(transport.getSubthread('thread-1', 'msg-missing')).rejects.toThrow(
			'Subthread not found',
		);
	});

	test('duplicateSystemAgent calls POST /api/chat/agents/duplicate', async () => {
		const agent = { id: 'dup-1', name: 'Duplicated' };
		mockFetch.mockResolvedValue(okJson(agent));

		const result = await transport.duplicateSystemAgent('system-1');

		expect(mockFetch).toHaveBeenCalledWith('/api/chat/agents/duplicate', expect.objectContaining({
			method: 'POST',
			body: JSON.stringify({ systemAgentId: 'system-1' }),
		}));
		expect(result).toEqual(agent);
	});

	test('inheritSystemAgent calls POST /api/chat/agents/inherit', async () => {
		const agent = { id: 'inherited-1', name: 'Inherited' };
		mockFetch.mockResolvedValue(okJson(agent));

		const result = await transport.inheritSystemAgent('system-1');

		expect(mockFetch).toHaveBeenCalledWith('/api/chat/agents/inherit', expect.objectContaining({
			method: 'POST',
			body: JSON.stringify({ systemAgentId: 'system-1' }),
		}));
		expect(result).toEqual(agent);
	});

	test('saveUserAgent calls POST /api/chat/agents/user', async () => {
		const input = {
			name: 'Custom',
			description: 'A custom agent',
			modelCardId: 'openai:gpt-4.1',
			systemPrompt: 'You are custom.',
		};
		const agent = { id: 'user-1', ...input };
		mockFetch.mockResolvedValue(okJson(agent));

		const result = await transport.saveUserAgent(input);

		expect(mockFetch).toHaveBeenCalledWith('/api/chat/agents/user', expect.objectContaining({
			method: 'POST',
			body: JSON.stringify(input),
		}));
		expect(result).toEqual(agent);
	});

	test('updateUserAgent calls PATCH /api/chat/agents/user/:id', async () => {
		const input = { systemPrompt: 'Updated prompt' };
		const agent = { id: 'user-1', name: 'Updated' };
		mockFetch.mockResolvedValue(okJson(agent));

		const result = await transport.updateUserAgent('user-1', input);

		expect(mockFetch).toHaveBeenCalledWith('/api/chat/agents/user/user-1', expect.objectContaining({
			method: 'PATCH',
			body: JSON.stringify(input),
		}));
		expect(result).toEqual(agent);
	});

	test('normalizes error response into Error', async () => {
		mockFetch.mockResolvedValue(errorJson(500, 'Agent catalog down'));

		await expect(transport.listAgents()).rejects.toThrow('Agent catalog down');
	});

	test('falls back to status code when error body has no message', async () => {
		mockFetch.mockResolvedValue(
			new Response('not json', { status: 502, headers: { 'content-type': 'text/plain' } }),
		);

		await expect(transport.listAgents()).rejects.toThrow('502');
	});
});
