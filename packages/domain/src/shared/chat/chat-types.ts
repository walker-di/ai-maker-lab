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

export interface AttachmentRef {
  readonly id: string;
  readonly messageId: string;
  readonly type: 'image' | 'file' | 'pdf' | 'video' | 'text';
  readonly name: string;
  readonly mimeType: string;
  readonly url?: string;
  readonly content?: string;
}

export interface ChatMessage {
  readonly id: string;
  readonly threadId: string;
  readonly role: ChatMessageRole;
  readonly content: string;
  readonly parentMessageId?: string;
  readonly agentId?: string;
  readonly chatRunId?: string;
  readonly attachments: readonly AttachmentRef[];
  readonly createdAt: string;
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
  readonly attachments?: readonly Omit<AttachmentRef, 'id' | 'messageId'>[];
}
