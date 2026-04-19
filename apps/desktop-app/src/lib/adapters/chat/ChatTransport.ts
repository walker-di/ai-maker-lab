import type {
	ChatThread,
	ChatMessage,
	ChatSubthread,
	ResolvedAgentProfile,
	CreateThreadInput,
} from 'domain/shared';

export type ChatRuntimeMode = 'desktop' | 'web';

export interface SaveUserAgentInput {
	readonly name: string;
	readonly description: string;
	readonly modelCardId: string;
	readonly systemPrompt: string;
	readonly toolOverrides?: Record<string, boolean>;
}

export interface UpdateUserAgentInput {
	readonly modelCardId?: string;
	readonly systemPrompt?: string;
	readonly toolOverrides?: Record<string, boolean>;
	readonly userOverrides?: Record<string, unknown>;
}

export interface ChatTransport {
	listAgents(): Promise<ResolvedAgentProfile[]>;
	listThreads(): Promise<ChatThread[]>;
	createThread(input: CreateThreadInput): Promise<ChatThread>;
	getThread(threadId: string): Promise<ChatThread | null>;
	updateThreadTitle(threadId: string, title: string): Promise<ChatThread>;
	setThreadAgent(threadId: string, agentId: string): Promise<ChatThread>;
	addThreadParticipant(threadId: string, agentId: string): Promise<ChatThread>;
	removeThreadParticipant(threadId: string, agentId: string): Promise<ChatThread>;
	deleteThread(threadId: string): Promise<void>;
	getMessages(threadId: string): Promise<ChatMessage[]>;
	getSubthread(threadId: string, parentMessageId: string): Promise<ChatSubthread>;
	/**
	 * Returns a string URL the UI can render directly (image src, video src,
	 * iframe src, etc) or `null` if the runtime cannot supply a previewable
	 * URL for this attachment. The UI must not construct `/api/...` URLs
	 * itself.
	 */
	getAttachmentPreviewUrl(threadId: string, attachmentId: string): string | null;
	fetchAttachmentText(threadId: string, attachmentId: string): Promise<string>;
	duplicateSystemAgent(systemAgentId: string): Promise<ResolvedAgentProfile>;
	inheritSystemAgent(systemAgentId: string): Promise<ResolvedAgentProfile>;
	saveUserAgent(input: SaveUserAgentInput): Promise<ResolvedAgentProfile>;
	updateUserAgent(id: string, input: UpdateUserAgentInput): Promise<ResolvedAgentProfile>;
}
