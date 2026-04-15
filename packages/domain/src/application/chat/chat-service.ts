import type { ModelMessage, StreamTextResult } from 'ai';
import type {
  ChatThread,
  ChatMessage,
  ChatRun,
  CreateThreadInput,
  CreateMessageInput,
  RouterDecision,
} from '../../shared/chat/index.js';
import type { ResolvedAgentProfile } from '../../shared/chat/index.js';
import type {
  IChatThreadRepository,
  IChatMessageRepository,
  IChatRunRepository,
} from './ports.js';
import type { AgentCatalogService } from './agent-catalog-service.js';
import type { ModelHandler } from './model-handler.js';
import { routeToAgent } from './chat-router.js';

export interface SendMessageInput {
  readonly text: string;
  readonly parentMessageId?: string;
  readonly attachments?: CreateMessageInput['attachments'];
}

export interface SendMessageResult {
  readonly userMessage: ChatMessage;
  readonly run: ChatRun;
  readonly streamResult: StreamTextResult<any, any>;
  readonly routerDecision: RouterDecision;
}

export class ChatService {
  constructor(
    private readonly threadRepo: IChatThreadRepository,
    private readonly messageRepo: IChatMessageRepository,
    private readonly runRepo: IChatRunRepository,
    private readonly catalogService: AgentCatalogService,
    private readonly modelHandler: ModelHandler,
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

  async listThreads(): Promise<ChatThread[]> {
    return this.threadRepo.list();
  }

  async getMessages(threadId: string): Promise<ChatMessage[]> {
    return this.messageRepo.listByThread(threadId);
  }

  async sendMessage(threadId: string, input: SendMessageInput): Promise<SendMessageResult> {
    const thread = await this.threadRepo.findById(threadId);
    if (!thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }

    if (input.parentMessageId) {
      const parent = await this.messageRepo.findById(input.parentMessageId);
      if (!parent) {
        throw new Error(`Parent message not found: ${input.parentMessageId}`);
      }
      if (parent.parentMessageId) {
        throw new Error('Reply chains are limited to one level deep.');
      }
    }

    const participants = await this.resolveParticipants(thread.participantIds);

    let parentMessage: ChatMessage | null = null;
    if (input.parentMessageId) {
      parentMessage = await this.messageRepo.findById(input.parentMessageId);
    }

    const decision = routeToAgent({
      text: input.text,
      parentMessage,
      defaultAgentId: thread.defaultAgentId,
      participants,
    });

    const agent = participants.find((p) => p.id === decision.agentId)!;

    const userMessage = await this.messageRepo.create({
      threadId,
      role: 'user',
      content: input.text,
      parentMessageId: input.parentMessageId,
      attachments: input.attachments,
    });

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

    const messages: ModelMessage[] = [
      { role: 'user' as const, content: input.text },
    ];

    const streamResult = this.modelHandler.stream(agent, {
      messages,
      threadId,
    });

    return { userMessage, run, streamResult, routerDecision: decision };
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
}
