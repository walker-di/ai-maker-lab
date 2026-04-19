export type ChatMessageRole = 'user' | 'assistant' | 'system';

export type ChatRunStatus = 'streaming' | 'completed' | 'failed' | 'cancelled';

export type RouterDecisionReason =
  | 'mention'
  | 'reply-context'
  | 'default-agent'
  | 'best-match'
  | 'fallback';

export interface ChatThread {
  readonly id: string;
  readonly title: string;
  readonly participantIds: readonly string[];
  readonly defaultAgentId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type AttachmentClassification = 'text' | 'image' | 'pdf' | 'video' | 'unsupported';

export type AttachmentStatus = 'pending' | 'ready' | 'unavailable' | 'rejected';

export type ChatToolInvocationState =
  | 'input-streaming'
  | 'input-available'
  | 'output-available'
  | 'error'
  | 'approval-requested'
  | 'approval-responded';

export interface AttachmentRef {
  readonly id: string;
  readonly messageId: string;
  readonly type: AttachmentClassification;
  readonly name: string;
  readonly mimeType: string;
  readonly path?: string;
  readonly inlineDataBase64?: string;
  readonly size: number;
  readonly lastModified: string;
  readonly status: AttachmentStatus;
}

export interface ChatToolInvocation {
  readonly toolCallId: string;
  readonly toolName: string;
  readonly state: ChatToolInvocationState;
  readonly input?: unknown;
  readonly output?: unknown;
  readonly errorText?: string;
  readonly providerExecuted?: boolean;
}

export interface ChatTextMessagePart {
  readonly type: 'text';
  readonly text: string;
}

export interface ChatImageMessagePart {
  readonly type: 'image';
  readonly url: string;
  readonly mimeType?: string;
  readonly name?: string;
  readonly alt?: string;
}

export interface ChatFileMessagePart {
  readonly type: 'file';
  readonly url: string;
  readonly mimeType?: string;
  readonly name: string;
}

export type ChatMessagePart =
  | ChatTextMessagePart
  | ChatImageMessagePart
  | ChatFileMessagePart;

export interface ChatMessage {
  readonly id: string;
  readonly threadId: string;
  readonly role: ChatMessageRole;
  readonly content: string;
  readonly parentMessageId?: string;
  readonly agentId?: string;
  readonly chatRunId?: string;
  readonly parts?: readonly ChatMessagePart[];
  readonly attachments: readonly AttachmentRef[];
  readonly toolInvocations: readonly ChatToolInvocation[];
  readonly createdAt: string;
}

export interface ChatSubthread {
  readonly parentMessage: ChatMessage;
  readonly replies: readonly ChatMessage[];
}

export interface ModelSnapshot {
  readonly registryId: string;
  readonly label: string;
}

export interface RunUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
}

export interface ChatRun {
  readonly id: string;
  readonly threadId: string;
  readonly messageId: string;
  readonly agentId: string;
  readonly modelSnapshot: ModelSnapshot;
  readonly status: ChatRunStatus;
  readonly usage?: RunUsage;
  readonly finishReason?: string;
  readonly startedAt: string;
  readonly completedAt?: string;
}

export interface RouterDecision {
  readonly agentId: string;
  readonly reason: RouterDecisionReason;
}

export interface CreateThreadInput {
  readonly title: string;
  readonly participantIds: readonly string[];
  readonly defaultAgentId?: string;
}

export interface CreateMessageInput {
  readonly threadId: string;
  readonly role: ChatMessageRole;
  readonly content: string;
  readonly parentMessageId?: string;
  readonly agentId?: string;
  readonly parts?: readonly ChatMessagePart[];
  readonly attachments?: readonly Omit<AttachmentRef, 'id'>[];
  readonly toolInvocations?: readonly ChatToolInvocation[];
}
