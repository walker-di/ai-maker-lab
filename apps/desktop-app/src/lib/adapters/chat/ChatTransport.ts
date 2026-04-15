import type {
	ChatThread,
	ChatMessage,
	ResolvedAgentProfile,
	CreateThreadInput,
} from 'domain/shared';

export type ChatRuntimeMode = 'desktop' | 'web';

export interface ChatTransport {
	listAgents(): Promise<ResolvedAgentProfile[]>;
	listThreads(): Promise<ChatThread[]>;
	createThread(input: CreateThreadInput): Promise<ChatThread>;
	getThread(threadId: string): Promise<ChatThread | null>;
	deleteThread(threadId: string): Promise<void>;
	getMessages(threadId: string): Promise<ChatMessage[]>;
	duplicateSystemAgent(systemAgentId: string): Promise<ResolvedAgentProfile>;
}
