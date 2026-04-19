import type { SystemAgentDefinition, StoredUserAgent, ChatThread, ChatMessage, ChatRun, AttachmentRef, AttachmentStatus, CreateThreadInput, CreateMessageInput } from '../../shared/chat/index.js';
export interface ISystemAgentDefinitionSource {
    loadAll(): SystemAgentDefinition[];
    findById(id: string): SystemAgentDefinition | undefined;
}
export interface CreateUserAgentInput {
    readonly name: string;
    readonly description: string;
    readonly modelCardId: string;
    readonly systemPrompt: string;
    readonly toolsEnabled?: boolean;
    readonly toolOverrides?: Record<string, boolean>;
    readonly inheritsFromSystemAgentId?: string;
    readonly duplicatedFromSystemAgentId?: string;
}
export interface UpdateUserAgentInput {
    readonly modelCardId?: string;
    readonly systemPrompt?: string;
    readonly toolsEnabled?: boolean;
    readonly toolOverrides?: Record<string, boolean>;
    readonly userOverrides?: Record<string, unknown>;
}
export interface IUserAgentRepository {
    list(): Promise<StoredUserAgent[]>;
    findById(id: string): Promise<StoredUserAgent | null>;
    create(input: CreateUserAgentInput): Promise<StoredUserAgent>;
    update(id: string, input: UpdateUserAgentInput): Promise<StoredUserAgent>;
    remove(id: string): Promise<void>;
}
export interface IChatThreadRepository {
    list(): Promise<ChatThread[]>;
    findById(id: string): Promise<ChatThread | null>;
    create(input: CreateThreadInput): Promise<ChatThread>;
    update(thread: ChatThread): Promise<ChatThread>;
    remove(id: string): Promise<void>;
}
export interface IChatMessageRepository {
    listByThread(threadId: string): Promise<ChatMessage[]>;
    findById(id: string): Promise<ChatMessage | null>;
    create(input: CreateMessageInput): Promise<ChatMessage>;
    listReplies(parentMessageId: string): Promise<ChatMessage[]>;
}
export interface IChatRunRepository {
    create(run: Omit<ChatRun, 'id'>): Promise<ChatRun>;
    update(run: ChatRun): Promise<ChatRun>;
    findById(id: string): Promise<ChatRun | null>;
    findByMessage(messageId: string): Promise<ChatRun | null>;
}
export interface IAttachmentRepository {
    create(attachment: Omit<AttachmentRef, 'id'>): Promise<AttachmentRef>;
    listByMessage(messageId: string): Promise<AttachmentRef[]>;
    updateStatus(id: string, status: AttachmentStatus): Promise<AttachmentRef>;
}
