import type {
	ChatThread,
	ChatMessage,
	ResolvedAgentProfile,
	CreateThreadInput,
} from 'domain/shared';
import type { ChatTransport } from './ChatTransport';

type ApiError = { error?: string };

async function parseJson<T>(response: Response): Promise<T> {
	if (response.ok) {
		return (await response.json()) as T;
	}
	const payload = (await response.json().catch(() => ({}))) as ApiError;
	throw new Error(payload.error ?? `Chat request failed with status ${response.status}`);
}

export function createWebChatTransport(): ChatTransport {
	return {
		async listAgents() {
			return parseJson<ResolvedAgentProfile[]>(await fetch('/api/chat/agents'));
		},

		async listThreads() {
			return parseJson<ChatThread[]>(await fetch('/api/chat/threads'));
		},

		async createThread(input: CreateThreadInput) {
			return parseJson<ChatThread>(
				await fetch('/api/chat/threads', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(input),
				}),
			);
		},

		async getThread(threadId: string) {
			const res = await fetch(`/api/chat/threads/${threadId}`);
			if (res.status === 404) return null;
			return parseJson<ChatThread>(res);
		},

		async deleteThread(threadId: string) {
			const res = await fetch(`/api/chat/threads/${threadId}`, { method: 'DELETE' });
			if (!res.ok) {
				const payload = (await res.json().catch(() => ({}))) as ApiError;
				throw new Error(payload.error ?? `Delete thread failed with status ${res.status}`);
			}
		},

		async getMessages(threadId: string) {
			return parseJson<ChatMessage[]>(await fetch(`/api/chat/threads/${threadId}/messages`));
		},

		async duplicateSystemAgent(systemAgentId: string) {
			return parseJson<ResolvedAgentProfile>(
				await fetch('/api/chat/agents/duplicate', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ systemAgentId }),
				}),
			);
		},
	};
}
