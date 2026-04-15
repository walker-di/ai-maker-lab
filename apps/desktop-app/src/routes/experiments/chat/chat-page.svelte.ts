import { Chat } from '@ai-sdk/svelte';
import { DefaultChatTransport } from 'ai';
import type {
	ChatThread,
	ChatMessage,
	ResolvedAgentProfile,
	ModelUiPresentation,
} from 'domain/shared';
import type { ChatTransport } from '$lib/adapters/chat/ChatTransport';

type CreateChatPageModelInput = {
	transport: ChatTransport;
};

export function createChatPageModel({ transport }: CreateChatPageModelInput) {
	let threads = $state<ChatThread[]>([]);
	let activeThreadId = $state<string | null>(null);
	let agents = $state<ResolvedAgentProfile[]>([]);
	let selectedAgentId = $state<string | null>(null);
	let messages = $state<ChatMessage[]>([]);
	let draft = $state('');
	let replyTarget = $state<ChatMessage | null>(null);
	let isLoadingThreads = $state(false);
	let isLoadingMessages = $state(false);
	let isLoadingAgents = $state(false);
	let isCreatingThread = $state(false);
	let errorMessage = $state<string | null>(null);
	let hasLoaded = $state(false);

	let chat = $state<Chat | null>(null);

	function buildChat(threadId: string): Chat {
		return new Chat({
			transport: new DefaultChatTransport({
				api: `/api/chat/threads/${threadId}/stream`,
			}),
			onError(err) {
				errorMessage = err instanceof Error ? err.message : String(err);
			},
		});
	}

	let activeThread = $derived(threads.find((t) => t.id === activeThreadId) ?? null);
	let selectedAgent = $derived(agents.find((a) => a.id === selectedAgentId) ?? null);
	let activePresentation = $derived<ModelUiPresentation | null>(
		selectedAgent?.modelCard.uiPresentation ?? null,
	);
	let disabledControls = $derived<readonly string[]>(
		activePresentation?.disabledComposerControls ?? [],
	);
	let chatMessages = $derived(chat?.messages ?? []);
	let chatStatus = $derived(chat?.status ?? 'ready');
	let chatError = $derived(chat?.error ?? null);
	let isStreaming = $derived(chatStatus === 'streaming' || chatStatus === 'submitted');
	let canCreateThread = $derived(hasLoaded && agents.length > 0 && !isCreatingThread);
	let hasChatSessionMessages = $derived(chatMessages.length > 0);

	async function apply<T>(action: () => Promise<T>): Promise<T | undefined> {
		try {
			errorMessage = null;
			return await action();
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'An error occurred.';
			console.error(err);
			return undefined;
		}
	}

	return {
		get threads() {
			return threads;
		},
		get activeThread() {
			return activeThread;
		},
		get activeThreadId() {
			return activeThreadId;
		},
		get agents() {
			return agents;
		},
		get selectedAgent() {
			return selectedAgent;
		},
		get selectedAgentId() {
			return selectedAgentId;
		},
		get messages() {
			return messages;
		},
		get draft() {
			return draft;
		},
		set draft(value: string) {
			draft = value;
		},
		get replyTarget() {
			return replyTarget;
		},
		get isLoadingThreads() {
			return isLoadingThreads;
		},
		get isLoadingMessages() {
			return isLoadingMessages;
		},
		get isLoadingAgents() {
			return isLoadingAgents;
		},
		get isCreatingThread() {
			return isCreatingThread;
		},
		get isStreaming() {
			return isStreaming;
		},
		get errorMessage() {
			return errorMessage;
		},
		get hasLoaded() {
			return hasLoaded;
		},
		get disabledControls() {
			return disabledControls;
		},
		get activePresentation() {
			return activePresentation;
		},
		get chatMessages() {
			return chatMessages;
		},
		get chatStatus() {
			return chatStatus;
		},
		get chatError() {
			return chatError;
		},
		get canSend() {
			return draft.trim().length > 0 && !isStreaming;
		},
		get canCreateThread() {
			return canCreateThread;
		},
		get hasChatSessionMessages() {
			return hasChatSessionMessages;
		},

		dismissError() {
			errorMessage = null;
		},

		async loadInitial() {
			isLoadingThreads = true;
			isLoadingAgents = true;
			errorMessage = null;
			try {
				const [threadResult, agentResult] = await Promise.allSettled([
					transport.listThreads(),
					transport.listAgents(),
				]);

				if (threadResult.status === 'fulfilled') {
					threads = threadResult.value;
				} else {
					console.error('Failed to load threads:', threadResult.reason);
				}

				if (agentResult.status === 'fulfilled') {
					agents = agentResult.value;
					if (agents.length > 0 && !selectedAgentId) {
						selectedAgentId = agents[0].id;
					}
				} else {
					errorMessage =
						agentResult.reason instanceof Error
							? agentResult.reason.message
							: 'Failed to load agents.';
					console.error('Failed to load agents:', agentResult.reason);
				}

				if (threadResult.status === 'rejected' && agentResult.status === 'rejected') {
					errorMessage = 'Failed to load threads and agents.';
				} else if (threadResult.status === 'rejected' && !errorMessage) {
					errorMessage =
						threadResult.reason instanceof Error
							? threadResult.reason.message
							: 'Failed to load threads.';
				}
			} finally {
				isLoadingThreads = false;
				isLoadingAgents = false;
				hasLoaded = true;
			}
		},

		async selectThread(threadId: string) {
			activeThreadId = threadId;
			chat = buildChat(threadId);

			isLoadingMessages = true;
			const result = await apply(() => transport.getMessages(threadId));
			if (result) {
				messages = result;
			}
			isLoadingMessages = false;
			replyTarget = null;
		},

		async createThread(title: string) {
			if (!canCreateThread) {
				if (hasLoaded && agents.length === 0) {
					errorMessage = 'No agents available. Cannot create a thread.';
				}
				return;
			}

			isCreatingThread = true;
			const agentId = selectedAgentId ?? agents[0].id;
			const result = await apply(() =>
				transport.createThread({
					title,
					participantIds: [agentId],
					defaultAgentId: agentId,
				}),
			);

			isCreatingThread = false;

			if (result) {
				threads = [result, ...threads];
				await this.selectThread(result.id);
			}
		},

		async deleteThread(threadId: string) {
			await apply(() => transport.deleteThread(threadId));
			threads = threads.filter((t) => t.id !== threadId);
			if (activeThreadId === threadId) {
				activeThreadId = null;
				messages = [];
				chat = null;
			}
		},

		selectAgent(agentId: string) {
			selectedAgentId = agentId;
		},

		async duplicateAgent(agentId: string) {
			const result = await apply(() => transport.duplicateSystemAgent(agentId));
			if (result) {
				agents = [...agents, result];
				selectedAgentId = result.id;
			}
		},

		setReplyTarget(message: ChatMessage | null) {
			replyTarget = message;
		},

		clearReply() {
			replyTarget = null;
		},

		async sendMessage() {
			if (!chat || !activeThreadId || !draft.trim()) return;

			const text = draft.trim();
			draft = '';

			const extraBody: Record<string, unknown> = {};
			if (replyTarget) {
				extraBody.parentMessageId = replyTarget.id;
			}
			replyTarget = null;

			const options = Object.keys(extraBody).length > 0 ? { body: extraBody } : undefined;
			chat.sendMessage({ text }, options);
		},

		stopStreaming() {
			chat?.stop();
		},
	};
}
