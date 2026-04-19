import { Chat } from '@ai-sdk/svelte';
import type {
	ChatThread,
	ChatMessage,
	ChatSubthread,
	AttachmentRef,
	ResolvedAgentProfile,
	ModelUiPresentation,
} from 'domain/shared';
import type { ChatTransport, SaveUserAgentInput, UpdateUserAgentInput } from '$lib/adapters/chat/ChatTransport';
import type { ChatStreamFactory } from '$lib/adapters/chat/create-chat-stream-transport';
import type {
	ChatHostedToolInfo as HostedToolInfo,
	ChatPendingAttachment as PendingAttachment,
	ChatToolInvocationAvailabilityInfo as ToolInvocationAvailabilityInfo,
	ChatToolInvocationInfo as ToolInvocationInfo,
} from 'ui/source';
import { resolveHostedTools, resolveToolAvailability, createChatComposerModel } from 'ui/source';

function encodeBase64(bytes: Uint8Array): string {
	let binary = '';
	const chunkSize = 0x8000;
	for (let index = 0; index < bytes.length; index += chunkSize) {
		const chunk = bytes.subarray(index, index + chunkSize);
		binary += String.fromCharCode(...chunk);
	}
	return btoa(binary);
}

async function buildAttachmentPayload(attachment: PendingAttachment) {
	const localPath = (attachment.file as File & { path?: string }).path?.trim();
	if (localPath) {
		return {
			type: attachment.classification,
			name: attachment.name,
			mimeType: attachment.mimeType,
			path: localPath,
			size: attachment.size,
			lastModified: new Date(attachment.file.lastModified).toISOString(),
			status: 'pending' as const,
			messageId: '',
		};
	}

	const bytes = new Uint8Array(await attachment.file.arrayBuffer());
	return {
		type: attachment.classification,
		name: attachment.name,
		mimeType: attachment.mimeType,
		inlineDataBase64: encodeBase64(bytes),
		size: attachment.size,
		lastModified: new Date(attachment.file.lastModified).toISOString(),
		status: 'pending' as const,
		messageId: '',
	};
}

type AttachmentPreviewKind = 'image' | 'pdf' | 'video' | 'text' | 'unsupported';

type AttachmentPreviewState = {
	threadId: string;
	attachment: AttachmentRef;
};

type ReplySummary = {
	parentMessageId: string;
	replyCount: number;
	latestReply: ChatMessage;
	participantNames: readonly string[];
};

function decodeInlineText(base64: string): string {
	const binary = atob(base64);
	const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
	return new TextDecoder().decode(bytes);
}

function getAttachmentPreviewKind(attachment: AttachmentRef | null): AttachmentPreviewKind {
	if (!attachment) {
		return 'unsupported';
	}

	switch (attachment.type) {
		case 'image':
		case 'pdf':
		case 'video':
		case 'text':
			return attachment.type;
		case 'unsupported':
			return 'unsupported';
	}
}

function buildInlinePreviewUrl(attachment: AttachmentRef | null): string | null {
	const base64 = attachment?.inlineDataBase64?.trim();
	if (!attachment || !base64 || attachment.type === 'text') {
		return null;
	}

	return `data:${attachment.mimeType};base64,${base64}`;
}

function buildAttachmentPreviewUrl(
	preview: AttachmentPreviewState | null,
	transport: Pick<ChatTransport, 'getAttachmentPreviewUrl'>,
): string | null {
	if (!preview || preview.attachment.type === 'unsupported') {
		return null;
	}

	const inlinePreviewUrl = buildInlinePreviewUrl(preview.attachment);
	if (inlinePreviewUrl) {
		return inlinePreviewUrl;
	}

	const attachmentId = preview.attachment.id?.trim();
	if (!attachmentId) {
		return null;
	}

	return transport.getAttachmentPreviewUrl(preview.threadId, attachmentId);
}

const DEFAULT_THREAD_TITLE = 'New conversation';
const UNTITLED_THREAD_TITLE = 'Untitled conversation';
const MAX_AUTO_THREAD_TITLE_LENGTH = 72;
const WRAPPING_QUOTES = new Set(['"', "'", '`']);

function stripWrappingQuotes(value: string): string {
	let result = value.trim();
	while (result.length > 1) {
		const first = result.at(0);
		const last = result.at(-1);
		if (!first || first !== last || !WRAPPING_QUOTES.has(first)) {
			break;
		}
		result = result.slice(1, -1).trim();
	}
	return result;
}

function truncateAutoThreadTitle(value: string): string {
	if (value.length <= MAX_AUTO_THREAD_TITLE_LENGTH) {
		return value;
	}

	return `${value.slice(0, MAX_AUTO_THREAD_TITLE_LENGTH - 3).trimEnd()}...`;
}

function normalizeAutoThreadTitle(value: string): string {
	const collapsed = value.trim().replace(/\s+/g, ' ');
	const unquoted = stripWrappingQuotes(collapsed);
	if (!unquoted) {
		return '';
	}

	return truncateAutoThreadTitle(unquoted);
}

function deriveAutoThreadTitle(text: string, attachments: readonly PendingAttachment[]): string {
	const fromText = normalizeAutoThreadTitle(text);
	if (fromText) {
		return fromText;
	}

	const fromAttachment = normalizeAutoThreadTitle(attachments[0]?.name ?? '');
	if (fromAttachment) {
		return fromAttachment;
	}

	return UNTITLED_THREAD_TITLE;
}

function getToolOverridesPayload(
	toolOverrides: Record<string, boolean>,
): Record<string, boolean> | undefined {
	return Object.keys(toolOverrides).length > 0 ? { ...toolOverrides } : undefined;
}

type CreateChatPageModelInput = {
	transport: ChatTransport;
	streamFactory: ChatStreamFactory;
	initialAgentId?: string | null;
	initialThreadId?: string | null;
	onThreadChange?: (threadId: string | null) => void;
};

export function createChatPageModel({
	transport,
	streamFactory,
	initialAgentId = null,
	initialThreadId = null,
	onThreadChange,
}: CreateChatPageModelInput) {
	let threads = $state<ChatThread[]>([]);
	let activeThreadId = $state<string | null>(null);
	let agents = $state<ResolvedAgentProfile[]>([]);
	let fallbackAgentId = $state<string | null>(null);
	let messages = $state<ChatMessage[]>([]);
	let draft = $state('');
	let activeSubthreadParentMessageId = $state<string | null>(null);
	let activeSubthread = $state<ChatSubthread | null>(null);
	let isLoadingSubthread = $state(false);
	let subthreadErrorMessage = $state<string | null>(null);
	let subthreadDraft = $state('');
	let activeSessionParentMessageId = $state<string | null>(null);
	let isLoadingThreads = $state(false);
	let isLoadingMessages = $state(false);
	let isLoadingAgents = $state(false);
	let isCreatingThread = $state(false);
	let errorMessage = $state<string | null>(null);
	let hasLoaded = $state(false);
	let autoTitleCandidateThreadIds = $state<string[]>([]);
	let toolOverrides = $state<Record<string, boolean>>({});
	let attachmentPreview = $state<AttachmentPreviewState | null>(null);
	let attachmentPreviewText = $state<string | null>(null);
	let attachmentPreviewLoadError = $state<string | null>(null);
	let isLoadingAttachmentPreview = $state(false);
	let attachmentPreviewRequestId = 0;

	let inspectedToolInvocation = $state<ToolInvocationInfo | null>(null);
	let inspectedToolAvailability = $state<ToolInvocationAvailabilityInfo | null>(null);

	const composerModel = createChatComposerModel();
	const subthreadComposerModel = createChatComposerModel();

	let chat = $state<Chat | null>(null);
	let showSessionMessages = $state(false);

	async function reconcileFinishedStream(threadId: string) {
		const messagesRefreshed = await refreshMessages(threadId);
		await refreshThreadList();

		if (messagesRefreshed && activeThreadId === threadId) {
			await refreshActiveSubthread(threadId);
			showSessionMessages = false;
			activeSessionParentMessageId = null;
			chat = buildChat(threadId);
		}
	}

	function buildChat(threadId: string): Chat {
		return new Chat({
			transport: streamFactory(threadId),
			onError(err) {
				errorMessage = err instanceof Error ? err.message : String(err);
			},
			async onFinish() {
				await reconcileFinishedStream(threadId);
			},
		});
	}

	function replaceThread(updatedThread: ChatThread) {
		threads = [updatedThread, ...threads.filter((thread) => thread.id !== updatedThread.id)];
	}

	function rememberAutoTitleCandidate(threadId: string) {
		if (autoTitleCandidateThreadIds.includes(threadId)) {
			return;
		}

		autoTitleCandidateThreadIds = [...autoTitleCandidateThreadIds, threadId];
	}

	function forgetAutoTitleCandidate(threadId: string) {
		autoTitleCandidateThreadIds = autoTitleCandidateThreadIds.filter((id) => id !== threadId);
	}

	function isUntouchedDefaultThread(thread: ChatThread): boolean {
		return (
			thread.title.trim() === DEFAULT_THREAD_TITLE &&
			thread.createdAt === thread.updatedAt
		);
	}

	function canAutoTitleThread(thread: ChatThread | null): thread is ChatThread {
		if (!thread) {
			return false;
		}

		return (
			autoTitleCandidateThreadIds.includes(thread.id) ||
			(messages.length === 0 && isUntouchedDefaultThread(thread))
		);
	}

	async function autoTitleThreadFromFirstMessage(
		text: string,
		attachments: readonly PendingAttachment[],
	) {
		const thread = activeThread;
		if (!thread || !canAutoTitleThread(thread)) {
			return;
		}

		const nextTitle = deriveAutoThreadTitle(text, attachments);
		const updated = await apply(() => transport.updateThreadTitle(thread.id, nextTitle));
		if (updated) {
			replaceThread(updated);
		}
		forgetAutoTitleCandidate(thread.id);
	}

	async function refreshThreadList() {
		try {
			const fresh = await transport.listThreads();
			threads = fresh;
		} catch {
			// Thread refresh is best-effort; don't overwrite the user's error state.
		}
	}

	async function refreshMessages(threadId: string): Promise<boolean> {
		try {
			const fresh = await transport.getMessages(threadId);
			if (activeThreadId === threadId) {
				messages = fresh;
				return true;
			}
		} catch {
			// Message refresh is best-effort.
		}

		return false;
	}

	function resetSubthreadState() {
		activeSubthreadParentMessageId = null;
		activeSubthread = null;
		isLoadingSubthread = false;
		subthreadErrorMessage = null;
		subthreadDraft = '';
		activeSessionParentMessageId = null;
		subthreadComposerModel.clearAttachments();
	}

	async function refreshActiveSubthread(threadId: string) {
		if (!activeSubthreadParentMessageId || activeThreadId !== threadId) {
			return;
		}

		try {
			const fresh = await transport.getSubthread(threadId, activeSubthreadParentMessageId);
			if (activeThreadId === threadId && activeSubthreadParentMessageId === fresh.parentMessage.id) {
				activeSubthread = fresh;
				subthreadErrorMessage = null;
			}
		} catch (error) {
			subthreadErrorMessage = error instanceof Error
				? error.message
				: 'Failed to load thread replies.';
		}
	}

	let activeThread = $derived(threads.find((t) => t.id === activeThreadId) ?? null);

	let agentLookup = $derived<Map<string, ResolvedAgentProfile>>(
		new Map(agents.map((a) => [a.id, a])),
	);

	let threadParticipants = $derived<ResolvedAgentProfile[]>(
		activeThread
			? activeThread!.participantIds
				.map((pid) => agents.find((a) => a.id === pid))
				.filter((a): a is ResolvedAgentProfile => a != null)
			: [],
	);

	let defaultAgent = $derived<ResolvedAgentProfile | null>(
		activeThread?.defaultAgentId
			? (agents.find((a) => a.id === activeThread!.defaultAgentId) ?? null)
			: activeThread && threadParticipants.length > 0
				? threadParticipants[0]
				: fallbackAgentId
					? (agents.find((a) => a.id === fallbackAgentId) ?? null)
					: null,
	);

	let activePresentation = $derived<ModelUiPresentation | null>(
		defaultAgent?.modelCard.uiPresentation ?? null,
	);
	let disabledControls = $derived<readonly string[]>(
		activePresentation?.disabledComposerControls ?? [],
	);
	let chatMessages = $derived(showSessionMessages ? (chat?.messages ?? []) : []);
	let timelineMessages = $derived(messages.filter((message) => !message.parentMessageId));
	let timelineSessionMessages = $derived(
		activeSessionParentMessageId ? [] : chatMessages,
	);
	let activeSubthreadReplies = $derived(activeSubthread?.replies ?? []);
	let activeSubthreadSessionMessages = $derived(
		activeSessionParentMessageId && activeSubthread?.parentMessage.id === activeSessionParentMessageId
			? chatMessages
			: [],
	);
	let replySummaries = $derived.by(() => {
		const summaryByParentId = new Map<string, ReplySummary>();
		const participantsByParentId = new Map<string, Set<string>>();

		for (const message of messages) {
			if (!message.parentMessageId) {
				continue;
			}

			const existing = summaryByParentId.get(message.parentMessageId);
			let participants = participantsByParentId.get(message.parentMessageId);
			if (!participants) {
				participants = new Set<string>();
				participantsByParentId.set(message.parentMessageId, participants);
			}
			const name = (message.role === 'assistant'
				? agentLookup.get(message.agentId ?? '')?.name ?? message.agentId
				: 'You') ?? 'Agent';
			participants.add(name);

			summaryByParentId.set(message.parentMessageId, {
				parentMessageId: message.parentMessageId,
				replyCount: (existing?.replyCount ?? 0) + 1,
				latestReply: existing && existing.latestReply.createdAt > message.createdAt
					? existing.latestReply
					: message,
				participantNames: Array.from(participants),
			});
		}
		return summaryByParentId;
	});
	let chatStatus = $derived(chat?.status ?? 'ready');
	let chatError = $derived(chat?.error ?? null);
	let isStreaming = $derived(chatStatus === 'streaming' || chatStatus === 'submitted');
	let canCreateThread = $derived(hasLoaded && agents.length > 0 && !isCreatingThread);
	let hasChatSessionMessages = $derived(chatMessages.length > 0);
	let isSubthreadOpen = $derived(activeSubthreadParentMessageId !== null);
	let previewedAttachment = $derived(attachmentPreview?.attachment ?? null);
	let attachmentPreviewKind = $derived<AttachmentPreviewKind>(
		getAttachmentPreviewKind(previewedAttachment),
	);
	let attachmentPreviewUrl = $derived<string | null>(
		buildAttachmentPreviewUrl(attachmentPreview, transport),
	);

	let resolvedTools = $derived<readonly HostedToolInfo[]>(
		defaultAgent
			? resolveHostedTools(defaultAgent as unknown as import('ui/source').ChatAgentProfile).map(
				(t) => ({
					...t,
					enabled: toolOverrides[t.name] ?? t.enabled,
				}),
			)
			: [],
	);
	let canSendSubthread = $derived(
		isSubthreadOpen
			&& (subthreadDraft.trim().length > 0 || subthreadComposerModel.hasAttachments)
			&& !isStreaming,
	);

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

	function resetAttachmentPreview() {
		attachmentPreviewRequestId += 1;
		attachmentPreview = null;
		attachmentPreviewText = null;
		attachmentPreviewLoadError = null;
		isLoadingAttachmentPreview = false;
	}

	async function loadTextAttachmentPreview(
		preview: AttachmentPreviewState,
		requestId: number,
	) {
		const inlineData = preview.attachment.inlineDataBase64?.trim();

		try {
			const text = inlineData
				? decodeInlineText(inlineData)
				: await transport.fetchAttachmentText(preview.threadId, preview.attachment.id);

			if (attachmentPreviewRequestId !== requestId) {
				return;
			}

			attachmentPreviewText = text;
		} catch (error) {
			if (attachmentPreviewRequestId !== requestId) {
				return;
			}

			attachmentPreviewLoadError = error instanceof Error
				? error.message
				: 'Failed to load attachment preview.';
		} finally {
			if (attachmentPreviewRequestId === requestId) {
				isLoadingAttachmentPreview = false;
			}
		}
	}

	async function openAttachmentPreview(attachment: AttachmentRef) {
		if (!activeThreadId) {
			return;
		}

		const preview = { threadId: activeThreadId, attachment };
		const requestId = attachmentPreviewRequestId + 1;
		attachmentPreviewRequestId = requestId;
		attachmentPreview = preview;
		attachmentPreviewText = null;
		attachmentPreviewLoadError = null;

    if (!attachment.inlineDataBase64?.trim() && !attachment.id?.trim()) {
      attachmentPreviewLoadError = 'Attachment preview is unavailable for this file.';
      isLoadingAttachmentPreview = false;
      return;
    }

		if (attachment.type === 'text') {
			isLoadingAttachmentPreview = true;
			await loadTextAttachmentPreview(preview, requestId);
			return;
		}

		isLoadingAttachmentPreview = false;
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
		get defaultAgent() {
			return defaultAgent;
		},
		get selectedAgent() {
			return defaultAgent;
		},
		get selectedAgentId() {
			return defaultAgent?.id ?? null;
		},
		get messages() {
			return messages;
		},
		get timelineMessages() {
			return timelineMessages;
		},
		get draft() {
			return draft;
		},
		set draft(value: string) {
			draft = value;
		},
		get subthreadDraft() {
			return subthreadDraft;
		},
		set subthreadDraft(value: string) {
			subthreadDraft = value;
		},
		get isSubthreadOpen() {
			return isSubthreadOpen;
		},
		get activeSubthread() {
			return activeSubthread;
		},
		get activeSubthreadReplies() {
			return activeSubthreadReplies;
		},
		get activeSubthreadSessionMessages() {
			return activeSubthreadSessionMessages;
		},
		get timelineSessionMessages() {
			return timelineSessionMessages;
		},
		get isLoadingSubthread() {
			return isLoadingSubthread;
		},
		get subthreadErrorMessage() {
			return subthreadErrorMessage;
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
		get attachmentPreviewOpen() {
			return attachmentPreview !== null;
		},
		set attachmentPreviewOpen(value: boolean) {
			if (!value) {
				resetAttachmentPreview();
			}
		},
		get previewedAttachment() {
			return previewedAttachment;
		},
		get attachmentPreviewKind() {
			return attachmentPreviewKind;
		},
		get attachmentPreviewUrl() {
			return attachmentPreviewUrl;
		},
		get attachmentPreviewText() {
			return attachmentPreviewText;
		},
		get attachmentPreviewLoadError() {
			return attachmentPreviewLoadError;
		},
		get isLoadingAttachmentPreview() {
			return isLoadingAttachmentPreview;
		},
		get toolDetailOpen() {
			return inspectedToolInvocation !== null;
		},
		set toolDetailOpen(value: boolean) {
			if (!value) {
				inspectedToolInvocation = null;
				inspectedToolAvailability = null;
			}
		},
		get inspectedToolInvocation() {
			return inspectedToolInvocation;
		},
		get inspectedToolAvailability() {
			return inspectedToolAvailability;
		},
		get canSend() {
			const hasContent = draft.trim().length > 0 || composerModel.hasAttachments;
			return hasContent && !isStreaming;
		},
		get canSendSubthread() {
			return canSendSubthread;
		},
		get canCreateThread() {
			return canCreateThread;
		},
		get hasChatSessionMessages() {
			return hasChatSessionMessages;
		},
		get threadParticipants() {
			return threadParticipants;
		},
		get hostedTools() {
			return resolvedTools;
		},

		get pendingAttachments() {
			return composerModel.pendingAttachments;
		},

		get subthreadPendingAttachments() {
			return subthreadComposerModel.pendingAttachments;
		},

		addFiles(files: FileList | File[]) {
			composerModel.addFiles(files);
		},

		addSubthreadFiles(files: FileList | File[]) {
			subthreadComposerModel.addFiles(files);
		},

		removeAttachment(localId: string) {
			composerModel.removeAttachment(localId);
		},

		removeSubthreadAttachment(localId: string) {
			subthreadComposerModel.removeAttachment(localId);
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
					if (agents.length > 0 && !fallbackAgentId) {
						fallbackAgentId =
							(initialAgentId && agents.find((agent) => agent.id === initialAgentId)?.id) ??
							agents[0].id;
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

			if (initialThreadId && threads.some((t) => t.id === initialThreadId)) {
				await this.selectThread(initialThreadId);
			}
		},

		async selectThread(threadId: string) {
			activeThreadId = threadId;
			showSessionMessages = false;
			activeSessionParentMessageId = null;
			chat = buildChat(threadId);
			toolOverrides = {};
			resetAttachmentPreview();
			resetSubthreadState();
			onThreadChange?.(threadId);

			isLoadingMessages = true;
			errorMessage = null;

			const threadCheck = await apply(() => transport.getThread(threadId));
			if (threadCheck === undefined) {
				activeThreadId = null;
				showSessionMessages = false;
				chat = null;
				isLoadingMessages = false;
				resetSubthreadState();
				onThreadChange?.(null);
				return;
			}
			if (threadCheck === null) {
				errorMessage = 'Thread not found. It may have been deleted.';
				threads = threads.filter((t) => t.id !== threadId);
				activeThreadId = null;
				showSessionMessages = false;
				chat = null;
				isLoadingMessages = false;
				resetSubthreadState();
				onThreadChange?.(null);
				return;
			}

			const result = await apply(() => transport.getMessages(threadId));
			if (result && activeThreadId === threadId) {
				messages = result;
			}
			isLoadingMessages = false;
		},

		async createThread(title: string) {
			if (!canCreateThread) {
				if (hasLoaded && agents.length === 0) {
					errorMessage = 'No agents available. Cannot create a thread.';
				}
				return;
			}

			isCreatingThread = true;
			const requestedTitle = title.trim();
			const shouldAutoTitle = requestedTitle.length === 0;
			const initialTitle = shouldAutoTitle ? DEFAULT_THREAD_TITLE : requestedTitle;
			const agentId = defaultAgent?.id ?? fallbackAgentId ?? agents[0].id;
			const result = await apply(() =>
				transport.createThread({
					title: initialTitle,
					participantIds: [agentId],
					defaultAgentId: agentId,
				}),
			);

			isCreatingThread = false;

			if (result) {
				if (shouldAutoTitle) {
					rememberAutoTitleCandidate(result.id);
				} else {
					forgetAutoTitleCandidate(result.id);
				}
				replaceThread(result);
				await this.selectThread(result.id);
			}
		},

		async updateThreadTitle(threadId: string, title: string) {
			const nextTitle = title.trim();
			if (!nextTitle) {
				errorMessage = 'Thread title cannot be empty.';
				return;
			}

			const updated = await apply(() => transport.updateThreadTitle(threadId, nextTitle));
			if (updated) {
				forgetAutoTitleCandidate(threadId);
				replaceThread(updated);
			}
		},

		async deleteThread(threadId: string) {
			await apply(() => transport.deleteThread(threadId));
			forgetAutoTitleCandidate(threadId);
			threads = threads.filter((t) => t.id !== threadId);
			if (activeThreadId === threadId) {
				activeThreadId = null;
				messages = [];
				showSessionMessages = false;
				activeSessionParentMessageId = null;
				chat = null;
				resetAttachmentPreview();
				resetSubthreadState();
				onThreadChange?.(null);
			}
		},

		async setDefaultAgent(agentId: string) {
			fallbackAgentId = agentId;
			if (!activeThreadId) return;
			const updated = await apply(() => transport.setThreadAgent(activeThreadId!, agentId));
			if (updated) {
				threads = threads.map((t) => (t.id === updated.id ? updated : t));
				toolOverrides = {};
			}
		},

		selectAgent(agentId: string) {
			this.setDefaultAgent(agentId);
		},

		async addAgentToThread(agentId: string) {
			if (!activeThreadId) return;
			const updated = await apply(() => transport.addThreadParticipant(activeThreadId!, agentId));
			if (updated) {
				threads = threads.map((t) => (t.id === updated.id ? updated : t));
			}
		},

		async removeAgentFromThread(agentId: string) {
			if (!activeThreadId) return;
			const updated = await apply(() => transport.removeThreadParticipant(activeThreadId!, agentId));
			if (updated) {
				threads = threads.map((t) => (t.id === updated.id ? updated : t));
			}
		},

		async duplicateAgent(agentId: string) {
			const result = await apply(() => transport.duplicateSystemAgent(agentId));
			if (result) {
				agents = [...agents, result];
			}
		},

		async inheritAgent(agentId: string) {
			const result = await apply(() => transport.inheritSystemAgent(agentId));
			if (result) {
				agents = [...agents, result];
			}
		},

		async saveUserAgent(input: SaveUserAgentInput) {
			const result = await apply(() => transport.saveUserAgent(input));
			if (result) {
				agents = [...agents, result];
			}
		},

		async updateUserAgent(id: string, input: UpdateUserAgentInput) {
			const result = await apply(() => transport.updateUserAgent(id, input));
			if (result) {
				agents = agents.map((a) => (a.id === id ? result : a));
			}
		},

		toggleTool(toolName: string, enabled: boolean) {
			toolOverrides = { ...toolOverrides, [toolName]: enabled };
		},

		getReplySummary(parentMessageId: string): ReplySummary | null {
			return replySummaries.get(parentMessageId) ?? null;
		},

		async openSubthread(message: ChatMessage) {
			if (!activeThreadId || message.parentMessageId) {
				return;
			}

			activeSubthreadParentMessageId = message.id;
			activeSubthread = {
				parentMessage: message,
				replies: [],
			};
			isLoadingSubthread = true;
			subthreadErrorMessage = null;

			try {
				const subthread = await transport.getSubthread(activeThreadId, message.id);
				if (activeThreadId && activeSubthreadParentMessageId === message.id) {
					activeSubthread = subthread;
				}
			} catch (error) {
				if (activeSubthreadParentMessageId === message.id) {
					subthreadErrorMessage = error instanceof Error
						? error.message
						: 'Failed to load thread replies.';
				}
			} finally {
				if (activeSubthreadParentMessageId === message.id) {
					isLoadingSubthread = false;
				}
			}
		},

		closeSubthread() {
			// Subthread sends route the in-flight stream into the panel by setting
			// `activeSessionParentMessageId` and `showSessionMessages`. If we don't
			// clear those when the panel closes, the main timeline filter
			// (`timelineSessionMessages`) keeps suppressing the streaming reply
			// and the user sees nothing until `onFinish` reconciles.
			resetSubthreadState();
			showSessionMessages = false;
		},

		openAttachmentPreview,

		closeAttachmentPreview() {
			resetAttachmentPreview();
		},

		inspectToolInvocation(invocation: ToolInvocationInfo) {
			inspectedToolInvocation = invocation;
			inspectedToolAvailability = resolveToolAvailability(
				defaultAgent as unknown as import('ui/source').ChatAgentProfile | undefined,
				invocation.toolName,
			);
		},

		closeToolDetail() {
			inspectedToolInvocation = null;
			inspectedToolAvailability = null;
		},

		async sendMessage() {
			if (!chat || !activeThreadId) return;

			const hasText = draft.trim().length > 0;
			const hasAttachments = composerModel.hasAttachments;
			if (!hasText && !hasAttachments) return;

			const text = draft.trim();
			const pendingAttachments = [...composerModel.pendingAttachments];
			draft = '';

			const extraBody: Record<string, unknown> = {};
			const toolOverridesPayload = getToolOverridesPayload(toolOverrides);

			if (hasAttachments) {
				try {
					extraBody.attachments = await Promise.all(
						pendingAttachments.map((attachment) => buildAttachmentPayload(attachment)),
					);
				} catch (error) {
					errorMessage = error instanceof Error
						? error.message
						: 'Failed to prepare attachments.';
					return;
				}
			}

			if (toolOverridesPayload) {
				extraBody.toolOverrides = toolOverridesPayload;
			}

			composerModel.clearAttachments();
			await autoTitleThreadFromFirstMessage(text, pendingAttachments);

			const options = Object.keys(extraBody).length > 0 ? { body: extraBody } : undefined;
			activeSessionParentMessageId = null;
			showSessionMessages = true;
			chat.sendMessage({ text: text || ' ' }, options);
		},

		async sendSubthreadMessage() {
			if (!chat || !activeThreadId || !activeSubthread?.parentMessage) {
				return;
			}

			const hasText = subthreadDraft.trim().length > 0;
			const hasAttachments = subthreadComposerModel.hasAttachments;
			if (!hasText && !hasAttachments) {
				return;
			}

			const text = subthreadDraft.trim();
			const pendingAttachments = [...subthreadComposerModel.pendingAttachments];
			subthreadDraft = '';
			subthreadErrorMessage = null;

			const extraBody: Record<string, unknown> = {
				parentMessageId: activeSubthread.parentMessage.id,
			};
			const toolOverridesPayload = getToolOverridesPayload(toolOverrides);

			if (hasAttachments) {
				try {
					extraBody.attachments = await Promise.all(
						pendingAttachments.map((attachment) => buildAttachmentPayload(attachment)),
					);
				} catch (error) {
					subthreadErrorMessage = error instanceof Error
						? error.message
						: 'Failed to prepare attachments.';
					return;
				}
			}

			if (toolOverridesPayload) {
				extraBody.toolOverrides = toolOverridesPayload;
			}

			subthreadComposerModel.clearAttachments();
			activeSessionParentMessageId = activeSubthread.parentMessage.id;
			showSessionMessages = true;
			chat.sendMessage({ text: text || ' ' }, { body: extraBody });
		},

		stopStreaming() {
			chat?.stop();
		},
	};
}
