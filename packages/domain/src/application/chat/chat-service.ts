import type { ModelMessage, StreamTextResult } from 'ai';
import type {
  ChatThread,
  ChatMessage,
  ChatSubthread,
  ChatRun,
  AttachmentRef,
  ChatToolInvocation,
  ChatMessagePart,
  CreateThreadInput,
  CreateMessageInput,
  RouterDecision,
} from '../../shared/chat/index.js';
import type { ResolvedAgentProfile } from '../../shared/chat/index.js';
import type {
  IChatThreadRepository,
  IChatMessageRepository,
  IChatRunRepository,
  IAttachmentRepository,
} from './ports.js';
import type { IAttachmentContentResolver } from './attachment-resolution.js';
import type { AgentCatalogService } from './agent-catalog-service.js';
import type { ModelHandler } from './model-handler.js';
import { routeToAgent } from './chat-router.js';
import { resolveAttachmentsForModel, getContentParts } from './attachment-policy-orchestrator.js';
import { extractToolInvocationsFromResponseMessages } from './tool-invocation-extractor.js';

type CreateAttachmentInput = NonNullable<CreateMessageInput['attachments']>[number];

function stripInlineAttachmentPayload(att: CreateAttachmentInput): CreateAttachmentInput {
  if (!att.inlineDataBase64) {
    return att;
  }
  const { inlineDataBase64: _omit, ...rest } = att;
  return rest;
}

export interface SendMessageInput {
  readonly text: string;
  readonly parentMessageId?: string;
  readonly toolOverrides?: Record<string, boolean>;
  readonly attachments?: CreateMessageInput['attachments'];
}

export interface SendMessageResult {
  readonly userMessage: ChatMessage;
  readonly run: ChatRun;
  readonly streamResult: StreamTextResult<any, any>;
  readonly routerDecision: RouterDecision;
}

export interface SendMessageOptions {
  readonly persistAssistantOnModelFinish?: boolean;
}

export interface PersistAssistantCompletionInput {
  readonly threadId: string;
  readonly agentId: string;
  readonly content: string;
  readonly parentMessageId?: string;
  readonly parts?: readonly ChatMessagePart[];
  readonly toolInvocations?: readonly ChatToolInvocation[];
}

export class ChatService {
  constructor(
    private readonly threadRepo: IChatThreadRepository,
    private readonly messageRepo: IChatMessageRepository,
    private readonly runRepo: IChatRunRepository,
    private readonly catalogService: AgentCatalogService,
    private readonly modelHandler: ModelHandler,
    private readonly attachmentRepo?: IAttachmentRepository,
    private readonly attachmentResolver?: IAttachmentContentResolver,
  ) {}

  async createThread(input: CreateThreadInput): Promise<ChatThread> {
    if (input.participantIds.length === 0) {
      throw new Error('Thread must have at least one agent participant.');
    }
    return this.threadRepo.create(input);
  }

  async deleteThread(threadId: string): Promise<void> {
    const thread = await this.threadRepo.findById(threadId);
    if (!thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }
    await this.threadRepo.remove(threadId);
  }

  async getThread(threadId: string): Promise<ChatThread | null> {
    return this.threadRepo.findById(threadId);
  }

  async updateThreadTitle(threadId: string, title: string): Promise<ChatThread> {
    const thread = await this.threadRepo.findById(threadId);
    if (!thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }

    const nextTitle = title.trim();
    if (!nextTitle) {
      throw new Error('Thread title cannot be empty.');
    }

    return this.threadRepo.update({
      ...thread,
      title: nextTitle,
    });
  }

  async listThreads(): Promise<ChatThread[]> {
    return this.threadRepo.list();
  }

  async getMessages(threadId: string): Promise<ChatMessage[]> {
    const messages = await this.messageRepo.listByThread(threadId);
    return this.hydrateMessageAttachments(messages);
  }

  async getSubthread(threadId: string, parentMessageId: string): Promise<ChatSubthread> {
    const parentMessage = await this.requireThreadRootMessage(threadId, parentMessageId);
    const replies = await this.messageRepo.listReplies(parentMessageId);

    const [hydratedParentMessage] = await this.hydrateMessageAttachments([parentMessage]);
    const hydratedReplies = await this.hydrateMessageAttachments(replies);

    return {
      parentMessage: hydratedParentMessage,
      replies: hydratedReplies,
    };
  }

  async setThreadAgent(threadId: string, agentId: string): Promise<ChatThread> {
    const thread = await this.threadRepo.findById(threadId);
    if (!thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }

    const agent = await this.catalogService.findAgent(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    const participantIds = thread.participantIds.includes(agentId)
      ? thread.participantIds
      : [...thread.participantIds, agentId];

    return this.threadRepo.update({
      ...thread,
      participantIds,
      defaultAgentId: agentId,
    });
  }

  async addThreadParticipant(threadId: string, agentId: string): Promise<ChatThread> {
    const thread = await this.threadRepo.findById(threadId);
    if (!thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }

    if (thread.participantIds.includes(agentId)) {
      return thread;
    }

    const agent = await this.catalogService.findAgent(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    return this.threadRepo.update({
      ...thread,
      participantIds: [...thread.participantIds, agentId],
    });
  }

  async removeThreadParticipant(threadId: string, agentId: string): Promise<ChatThread> {
    const thread = await this.threadRepo.findById(threadId);
    if (!thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }

    if (!thread.participantIds.includes(agentId)) {
      return thread;
    }

    if (thread.participantIds.length <= 1) {
      throw new Error('Thread must have at least one participant.');
    }

    const participantIds = thread.participantIds.filter((id) => id !== agentId);
    const defaultAgentId = thread.defaultAgentId === agentId
      ? participantIds[0]
      : thread.defaultAgentId;

    return this.threadRepo.update({
      ...thread,
      participantIds,
      defaultAgentId,
    });
  }

  async sendMessage(
    threadId: string,
    input: SendMessageInput,
    options: SendMessageOptions = {},
  ): Promise<SendMessageResult> {
    const { persistAssistantOnModelFinish = true } = options;
    const thread = await this.threadRepo.findById(threadId);
    if (!thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }

    const participants = await this.resolveParticipants(thread.participantIds);

    let parentMessage: ChatMessage | null = null;
    if (input.parentMessageId) {
      parentMessage = await this.requireThreadRootMessage(threadId, input.parentMessageId);
    }

    const decision = routeToAgent({
      text: input.text,
      parentMessage,
      defaultAgentId: thread.defaultAgentId,
      participants,
    });

    const agent = participants.find((p) => p.id === decision.agentId)!;
    const effectiveAgent = input.toolOverrides
      ? {
        ...agent,
        toolState: {
          ...agent.toolState,
          ...input.toolOverrides,
        },
      }
      : agent;

    // When an attachment repository is configured we persist the binary payload
    // into the dedicated `attachment` table and keep the embedded message-row
    // attachments as metadata-only refs to avoid storing the same base64 twice.
    const messageAttachmentsForRow = this.attachmentRepo && input.attachments
      ? input.attachments.map(stripInlineAttachmentPayload)
      : input.attachments;

    const userMessage = await this.messageRepo.create({
      threadId,
      role: 'user',
      content: input.text,
      parentMessageId: input.parentMessageId,
      attachments: messageAttachmentsForRow,
    });

    let persistedAttachments: readonly AttachmentRef[] = userMessage.attachments;
    if (input.attachments && input.attachments.length > 0 && this.attachmentRepo) {
      const createdAttachments: AttachmentRef[] = [];
      for (const att of input.attachments) {
        createdAttachments.push(
          await this.attachmentRepo.create({ ...att, messageId: userMessage.id }),
        );
      }
      persistedAttachments = createdAttachments;
    }

    const hydratedUserMessage = persistedAttachments === userMessage.attachments
      ? userMessage
      : { ...userMessage, attachments: persistedAttachments };

    const rawHistory = await this.messageRepo.listByThread(threadId);
    // Replace the freshly persisted user-message row (whose attachments are
    // metadata-only) with the hydrated copy so resolvers can access inline
    // bytes when no attachment repository is configured.
    const history = rawHistory.map((m) =>
      m.id === hydratedUserMessage.id ? hydratedUserMessage : m,
    );
    const hydratedHistory = await this.hydrateMessageAttachments(history);
    const messages: ModelMessage[] = await this.buildModelMessages(
      hydratedHistory,
      effectiveAgent,
      hydratedUserMessage,
    );

    const run = await this.runRepo.create({
      threadId,
      messageId: userMessage.id,
      agentId: agent.id,
      modelSnapshot: {
        registryId: agent.modelCard.registryId,
        label: agent.modelCard.label,
      },
      status: 'streaming',
      startedAt: new Date().toISOString(),
    });

    const attachmentClassifications = (hydratedUserMessage.attachments ?? []).map(
      (att) => att.type,
    );

    const streamResult = this.modelHandler.stream(effectiveAgent, {
      messages,
      threadId,
      attachmentClassifications,
      onFinish: async ({ text, finishReason, response }) => {
        if (persistAssistantOnModelFinish) {
          try {
            const toolInvocations = extractToolInvocationsFromResponseMessages(response.messages);
            await this.persistAssistantCompletion({
              threadId,
              agentId: agent.id,
              content: text,
              parentMessageId: input.parentMessageId,
              toolInvocations,
            });
          } catch (error) {
            console.warn('[chat-service] failed to persist assistant completion', {
              threadId,
              runId: run.id,
              agentId: agent.id,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        try {
          await this.runRepo.update({
            ...run,
            status: finishReason === 'stop' ? 'completed' : 'failed',
            completedAt: new Date().toISOString(),
          });
        } catch (error) {
          console.warn('[chat-service] failed to finalize run', {
            threadId,
            runId: run.id,
            agentId: agent.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
    });

    return { userMessage: hydratedUserMessage, run, streamResult, routerDecision: decision };
  }

  async persistAssistantCompletion(
    input: PersistAssistantCompletionInput,
  ): Promise<ChatMessage | null> {
    const parts = [...(input.parts ?? [])];
    const toolInvocations = [...(input.toolInvocations ?? [])];
    if (!input.content && parts.length === 0 && toolInvocations.length === 0) {
      return null;
    }

    return this.messageRepo.create({
      threadId: input.threadId,
      role: 'assistant',
      content: input.content,
      parentMessageId: input.parentMessageId,
      agentId: input.agentId,
      parts,
      toolInvocations,
    });
  }

  private async buildModelMessages(
    history: readonly ChatMessage[],
    agent: ResolvedAgentProfile,
    currentUserMessage: ChatMessage,
  ): Promise<ModelMessage[]> {
    const messages: ModelMessage[] = [];

    for (const m of history) {
      if (m.id === currentUserMessage.id && m.attachments.length > 0) {
        if (!this.attachmentResolver) {
          throw new Error('Attachments are not supported in this runtime.');
        }

        const resolved = await resolveAttachmentsForModel(
          m.attachments,
          agent.modelCard.inputPolicy,
          this.attachmentResolver,
        );

        const contentParts = getContentParts(resolved);
        if (contentParts.length === 0) {
          const firstReason = resolved.find((result) => result.rejectionReason)?.rejectionReason
            ?? resolved.find((result) => result.policyReason)?.policyReason;
          throw new Error(
            firstReason
              ? `Attachments could not be resolved for model input: ${firstReason}`
              : 'Attachments could not be resolved for model input.',
          );
        }

        // Attachments with `transform`/`augment-with-tools` outcomes resolve as
        // `rejected: false` but produce no `contentPart`. We don't have a
        // transform pipeline wired in yet, so refuse to silently drop those
        // attachments while the rest are sent to the model.
        const unsupportedNonRejected = resolved.filter(
          (r) =>
            !r.rejected
            && r.contentPart == null
            && r.classification !== 'unsupported',
        );
        if (unsupportedNonRejected.length > 0) {
          const names = unsupportedNonRejected
            .map((r) => r.attachment.name || r.classification)
            .join(', ');
          throw new Error(
            `Attachments require a transform pipeline that is not implemented yet: ${names}.`,
          );
        }

        if (contentParts.length > 0) {
          const parts: Array<{ type: string; [key: string]: unknown }> = [
            { type: 'text', text: m.content },
          ];

          for (const part of contentParts) {
            if (part.type === 'text') {
              parts.push({ type: 'text', text: part.text });
            } else if (part.type === 'image') {
              parts.push({ type: 'image', image: part.data, mimeType: part.mimeType });
            } else if (part.type === 'file') {
              parts.push({ type: 'file', data: part.data, mimeType: part.mimeType });
            }
          }

          messages.push({
            role: 'user',
            content: parts as ModelMessage['content'],
          } as ModelMessage);
          continue;
        }
      }

      messages.push({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      });
    }

    return messages;
  }

  private async resolveParticipants(
    participantIds: readonly string[],
  ): Promise<ResolvedAgentProfile[]> {
    const resolved: ResolvedAgentProfile[] = [];
    for (const id of participantIds) {
      const agent = await this.catalogService.findAgent(id);
      if (!agent) {
        throw new Error(`Participant agent not found: ${id}`);
      }
      resolved.push(agent);
    }
    return resolved;
  }

  private async requireThreadRootMessage(
    threadId: string,
    messageId: string,
  ): Promise<ChatMessage> {
    const message = await this.messageRepo.findById(messageId);
    if (!message) {
      throw new Error(`Parent message not found: ${messageId}`);
    }
    if (message.threadId !== threadId) {
      throw new Error(`Parent message ${messageId} does not belong to thread ${threadId}.`);
    }
    if (message.parentMessageId) {
      throw new Error('Reply chains are limited to one level deep.');
    }
    return message;
  }

  private async hydrateMessageAttachments(
    messages: readonly ChatMessage[],
  ): Promise<ChatMessage[]> {
    if (!this.attachmentRepo) {
      return [...messages];
    }

    return Promise.all(
      messages.map(async (message) => {
        const hydratedAttachments = await this.attachmentRepo!.listByMessage(message.id);
        return {
          ...message,
          attachments: hydratedAttachments.length > 0 ? hydratedAttachments : message.attachments,
        };
      }),
    );
  }
}
