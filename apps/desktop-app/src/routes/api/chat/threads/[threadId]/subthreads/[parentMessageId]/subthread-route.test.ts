import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { ChatMessage, ChatSubthread } from 'domain/shared';

const getChatServicesMock = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/chat-services', async () => {
	const actual =
		await vi.importActual<typeof import('$lib/server/chat-services')>('$lib/server/chat-services');

	return {
		...actual,
		getChatServices: getChatServicesMock,
	};
});

function makeMessage(overrides: Partial<ChatMessage>): ChatMessage {
	return {
		id: overrides.id ?? 'msg',
		threadId: overrides.threadId ?? 'thread-1',
		role: overrides.role ?? 'user',
		content: overrides.content ?? '',
		attachments: overrides.attachments ?? [],
		toolInvocations: overrides.toolInvocations ?? [],
		createdAt: overrides.createdAt ?? '2026-04-16T00:00:00.000Z',
		...overrides,
	} satisfies ChatMessage;
}

describe('GET /api/chat/threads/[threadId]/subthreads/[parentMessageId]', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('returns the subthread JSON with parent message and replies on success', async () => {
		const { GET } = await import('./+server');

		const subthread: ChatSubthread = {
			parentMessage: makeMessage({ id: 'parent-1', role: 'user', content: 'Parent question' }),
			replies: [
				makeMessage({
					id: 'reply-1',
					role: 'assistant',
					content: 'Assistant reply',
					parentMessageId: 'parent-1',
					agentId: 'system-general',
				}),
				makeMessage({
					id: 'reply-2',
					role: 'user',
					content: 'Follow-up',
					parentMessageId: 'parent-1',
				}),
			],
		};
		const getSubthread = vi.fn().mockResolvedValue(subthread);
		getChatServicesMock.mockResolvedValue({
			chatService: { getSubthread },
		});

		const response = await GET({
			params: { threadId: 'thread-1', parentMessageId: 'parent-1' },
			// biome-ignore lint/suspicious/noExplicitAny: SvelteKit RequestEvent is not relevant here.
		} as any);

		expect(getSubthread).toHaveBeenCalledWith('thread-1', 'parent-1');
		expect(response.status).toBe(200);
		const body = (await response.json()) as ChatSubthread;
		expect(body.parentMessage.id).toBe('parent-1');
		expect(body.replies.map((reply) => reply.id)).toEqual(['reply-1', 'reply-2']);
		expect(body.replies.every((reply) => reply.parentMessageId === 'parent-1')).toBe(true);
	});

	test('returns a 404-shaped error response when the parent message is not found', async () => {
		const { GET } = await import('./+server');

		const getSubthread = vi
			.fn()
			.mockRejectedValue(new Error('Parent message parent-missing not found in thread thread-1'));
		getChatServicesMock.mockResolvedValue({
			chatService: { getSubthread },
		});

		const response = await GET({
			params: { threadId: 'thread-1', parentMessageId: 'parent-missing' },
			// biome-ignore lint/suspicious/noExplicitAny: SvelteKit RequestEvent is not relevant here.
		} as any);

		expect(getSubthread).toHaveBeenCalledWith('thread-1', 'parent-missing');
		expect(response.status).toBeGreaterThanOrEqual(400);
		const body = (await response.json()) as { error?: string };
		expect(body.error).toContain('parent-missing');
	});
});
