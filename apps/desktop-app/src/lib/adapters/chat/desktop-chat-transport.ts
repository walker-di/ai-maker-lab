import type { ChatSubthread, CreateThreadInput } from 'domain/shared';
import type {
	ChatTransport,
	SaveUserAgentInput,
	UpdateUserAgentInput,
} from './ChatTransport';
import type { DesktopWebviewRpc } from '../runtime/desktop-runtime';
import { normalizeRecord, normalizeList } from '../runtime/surreal-id-normalizer';

function normalizeSubthread(subthread: ChatSubthread): ChatSubthread {
	return {
		parentMessage: normalizeRecord(subthread.parentMessage),
		replies: normalizeList([...subthread.replies]),
	};
}

export function createDesktopChatTransport(rpc: DesktopWebviewRpc): ChatTransport {
	return {
		async listAgents() {
			return normalizeList(await rpc.request.listAgents());
		},

		async listThreads() {
			return normalizeList(await rpc.request.listThreads());
		},

		async createThread(input: CreateThreadInput) {
			const thread = await rpc.request.createThread({
				title: input.title,
				participantIds: [...input.participantIds],
				defaultAgentId: input.defaultAgentId,
			});
			return normalizeRecord(thread);
		},

		async getThread(threadId: string) {
			const thread = await rpc.request.getThread({ threadId });
			return thread ? normalizeRecord(thread) : null;
		},

		async updateThreadTitle(threadId: string, title: string) {
			return normalizeRecord(await rpc.request.updateThreadTitle({ threadId, title }));
		},

		async setThreadAgent(threadId: string, agentId: string) {
			return normalizeRecord(await rpc.request.setThreadAgent({ threadId, agentId }));
		},

		async addThreadParticipant(threadId: string, agentId: string) {
			return normalizeRecord(await rpc.request.addThreadParticipant({ threadId, agentId }));
		},

		async removeThreadParticipant(threadId: string, agentId: string) {
			return normalizeRecord(await rpc.request.removeThreadParticipant({ threadId, agentId }));
		},

		async deleteThread(threadId: string) {
			await rpc.request.deleteThread({ threadId });
		},

		async getMessages(threadId: string) {
			return normalizeList(await rpc.request.getMessages({ threadId }));
		},

		async getSubthread(threadId: string, parentMessageId: string) {
			return normalizeSubthread(
				await rpc.request.getSubthread({ threadId, parentMessageId }),
			);
		},

		getAttachmentPreviewUrl(_threadId: string, _attachmentId: string) {
			return null;
		},

		async fetchAttachmentText(_threadId: string, _attachmentId: string): Promise<string> {
			throw new Error(
				'Desktop runtime cannot fetch attachment previews; use inline data instead.',
			);
		},

		async duplicateSystemAgent(systemAgentId: string) {
			return normalizeRecord(await rpc.request.duplicateSystemAgent({ systemAgentId }));
		},

		async inheritSystemAgent(systemAgentId: string) {
			return normalizeRecord(await rpc.request.inheritSystemAgent({ systemAgentId }));
		},

		async saveUserAgent(input: SaveUserAgentInput) {
			return normalizeRecord(await rpc.request.saveUserAgent(input));
		},

		async updateUserAgent(id: string, input: UpdateUserAgentInput) {
			return normalizeRecord(await rpc.request.updateUserAgent({ id, input }));
		},
	};
}
