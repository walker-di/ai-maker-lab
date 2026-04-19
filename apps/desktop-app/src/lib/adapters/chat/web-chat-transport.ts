import type {
	ChatThread,
	ChatMessage,
	ChatSubthread,
	ResolvedAgentProfile,
	CreateThreadInput,
} from 'domain/shared';
import type { ChatTransport, SaveUserAgentInput, UpdateUserAgentInput } from './ChatTransport';

type ApiError = { error?: string };

async function parseJson<T>(response: Response): Promise<T> {
	if (response.ok) {
		return (await response.json()) as T;
	}
	const payload = (await response.json().catch(() => ({}))) as ApiError;
	throw new Error(payload.error ?? `Chat request failed with status ${response.status}`);
}

function postJson(url: string, body: unknown): Promise<Response> {
	return fetch(url, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
	});
}

function patchJson(url: string, body: unknown): Promise<Response> {
	return fetch(url, {
		method: 'PATCH',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
	});
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
			return parseJson<ChatThread>(await postJson('/api/chat/threads', input));
		},

		async getThread(threadId: string) {
			const res = await fetch(`/api/chat/threads/${threadId}`);
			if (res.status === 404) return null;
			return parseJson<ChatThread>(res);
		},

		async updateThreadTitle(threadId: string, title: string) {
			return parseJson<ChatThread>(
				await patchJson(`/api/chat/threads/${threadId}`, { title }),
			);
		},

		async setThreadAgent(threadId: string, agentId: string) {
			return parseJson<ChatThread>(
				await patchJson(`/api/chat/threads/${threadId}`, { defaultAgentId: agentId }),
			);
		},

		async addThreadParticipant(threadId: string, agentId: string) {
			return parseJson<ChatThread>(
				await patchJson(`/api/chat/threads/${threadId}`, { addParticipantId: agentId }),
			);
		},

		async removeThreadParticipant(threadId: string, agentId: string) {
			return parseJson<ChatThread>(
				await patchJson(`/api/chat/threads/${threadId}`, { removeParticipantId: agentId }),
			);
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

		async getSubthread(threadId: string, parentMessageId: string) {
			return parseJson<ChatSubthread>(
				await fetch(`/api/chat/threads/${threadId}/subthreads/${parentMessageId}`),
			);
		},

		getAttachmentPreviewUrl(threadId, attachmentId) {
			if (!threadId || !attachmentId) return null;
			return `/api/chat/threads/${threadId}/attachments/${attachmentId}`;
		},

		async fetchAttachmentText(threadId, attachmentId) {
			const url = `/api/chat/threads/${threadId}/attachments/${attachmentId}`;
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error('Failed to load attachment preview.');
			}
			return response.text();
		},

		async duplicateSystemAgent(systemAgentId: string) {
			return parseJson<ResolvedAgentProfile>(
				await postJson('/api/chat/agents/duplicate', { systemAgentId }),
			);
		},

		async inheritSystemAgent(systemAgentId: string) {
			return parseJson<ResolvedAgentProfile>(
				await postJson('/api/chat/agents/inherit', { systemAgentId }),
			);
		},

		async saveUserAgent(input: SaveUserAgentInput) {
			return parseJson<ResolvedAgentProfile>(
				await postJson('/api/chat/agents/user', input),
			);
		},

		async updateUserAgent(id: string, input: UpdateUserAgentInput) {
			return parseJson<ResolvedAgentProfile>(
				await patchJson(`/api/chat/agents/user/${id}`, input),
			);
		},
	};
}
