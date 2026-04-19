import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { Surreal } from 'surrealdb';
import type { SystemAgentDefinition, AttachmentRef } from '../../shared/chat/index.js';
import { Gpt41ModelCard, Claude4SonnetModelCard, MODEL_CARD_CATALOG } from '../../shared/chat/index.js';
import { createDbConnection } from '../../infrastructure/database/client.js';
import { SurrealDbAdapter } from '../../infrastructure/database/SurrealDbAdapter.js';
import { SurrealChatThreadRepository } from '../../infrastructure/database/chat/SurrealChatThreadRepository.js';
import { SurrealChatMessageRepository } from '../../infrastructure/database/chat/SurrealChatMessageRepository.js';
import { SurrealChatRunRepository } from '../../infrastructure/database/chat/SurrealChatRunRepository.js';
import { SurrealUserAgentRepository } from '../../infrastructure/database/chat/SurrealUserAgentRepository.js';
import { SurrealAttachmentRepository } from '../../infrastructure/database/chat/SurrealAttachmentRepository.js';
import type { IAttachmentContentResolver, ResolvedContentPart } from './attachment-resolution.js';
import { ModelHandler } from './model-handler.js';
import { AgentCatalogService } from './agent-catalog-service.js';
import { ChatService } from './chat-service.js';
import {
  HOSTED_TOOL_FIXTURES,
  InMemorySystemSource,
  createMockRegistry,
  createMockLanguageModel,
} from './__test-helpers__/test-fixtures.js';

const SYSTEM_GENERAL: SystemAgentDefinition = {
  id: 'system-general',
  name: 'General Assistant',
  description: 'A helpful general-purpose assistant.',
  modelCard: Gpt41ModelCard,
  systemPrompt: 'You are a helpful assistant.',
  defaultToolState: {},
  metadata: {},
};

const SYSTEM_CREATIVE: SystemAgentDefinition = {
  id: 'system-creative',
  name: 'Creative Writer',
  description: 'An assistant for creative writing.',
  modelCard: Claude4SonnetModelCard,
  systemPrompt: 'You are a creative writer.',
  defaultToolState: {},
  metadata: {},
};

class FakeAttachmentResolver implements IAttachmentContentResolver {
  constructor(
    private readonly resolveFn: (attachment: AttachmentRef) => ResolvedContentPart | null | Promise<ResolvedContentPart | null>,
    private readonly availabilityFn: (attachment: AttachmentRef) => boolean | Promise<boolean> = () => true,
  ) {}

  async resolve(attachment: AttachmentRef): Promise<ResolvedContentPart | null> {
    return this.resolveFn(attachment);
  }

  async checkAvailability(attachment: AttachmentRef): Promise<boolean> {
    return this.availabilityFn(attachment);
  }
}

describe('ChatService', () => {
  let db: Surreal;
  let chatService: ChatService;
  let messageRepo: SurrealChatMessageRepository;

  beforeEach(async () => {
    db = await createDbConnection({
      host: 'mem://',
      namespace: `test_ns_${crypto.randomUUID()}`,
      database: `test_db_${crypto.randomUUID()}`,
    });

    const adapter = new SurrealDbAdapter(db);
    const threadRepo = new SurrealChatThreadRepository(adapter);
    messageRepo = new SurrealChatMessageRepository(adapter);
    const runRepo = new SurrealChatRunRepository(adapter);
    const userAgentRepo = new SurrealUserAgentRepository(adapter);

    const systemSource = new InMemorySystemSource([SYSTEM_GENERAL, SYSTEM_CREATIVE]);
    const catalogService = new AgentCatalogService(systemSource, userAgentRepo, MODEL_CARD_CATALOG);
    const registry = createMockRegistry();
    const modelHandler = new ModelHandler(registry);

    chatService = new ChatService(threadRepo, messageRepo, runRepo, catalogService, modelHandler);
  });

  afterEach(async () => { await db.close(); });

  test('creates a thread with at least one participant', async () => {
    const thread = await chatService.createThread({
      title: 'Test Thread',
      participantIds: ['system-general'],
    });

    expect(thread.id).toBeString();
    expect(thread.title).toBe('Test Thread');
    expect(thread.participantIds).toEqual(['system-general']);
  });

  test('throws when creating thread with no participants', async () => {
    await expect(
      chatService.createThread({ title: 'Empty', participantIds: [] }),
    ).rejects.toThrow('Thread must have at least one agent participant.');
  });

  test('lists threads', async () => {
    await chatService.createThread({ title: 'A', participantIds: ['system-general'] });
    await chatService.createThread({ title: 'B', participantIds: ['system-creative'] });

    const threads = await chatService.listThreads();
    expect(threads.length).toBe(2);
  });

  test('gets thread by id', async () => {
    const created = await chatService.createThread({ title: 'Find Me', participantIds: ['system-general'] });

    const found = await chatService.getThread(created.id);
    expect(found).toBeDefined();
    expect(found!.title).toBe('Find Me');
  });

  test('updates a thread title', async () => {
    const created = await chatService.createThread({
      title: 'Original Title',
      participantIds: ['system-general'],
    });

    const updated = await chatService.updateThreadTitle(created.id, '  Renamed Thread  ');

    expect(updated.title).toBe('Renamed Thread');
    expect(updated.participantIds).toEqual(['system-general']);
  });

  test('rejects an empty thread title update', async () => {
    const created = await chatService.createThread({
      title: 'Stable Title',
      participantIds: ['system-general'],
    });

    await expect(
      chatService.updateThreadTitle(created.id, '   '),
    ).rejects.toThrow('Thread title cannot be empty.');
  });

  test('deletes a thread', async () => {
    const created = await chatService.createThread({ title: 'Delete Me', participantIds: ['system-general'] });

    await chatService.deleteThread(created.id);
    const found = await chatService.getThread(created.id);
    expect(found).toBeNull();
  });

  test('deleteThread throws for nonexistent thread', async () => {
    await expect(chatService.deleteThread('nonexistent')).rejects.toThrow(
      'Thread not found: nonexistent',
    );
  });

  test('sendMessage routes to fallback agent and creates run', async () => {
    const thread = await chatService.createThread({
      title: 'Chat',
      participantIds: ['system-general'],
    });

    const result = await chatService.sendMessage(thread.id, { text: 'Hello' });

    expect(result.userMessage.role).toBe('user');
    expect(result.userMessage.content).toBe('Hello');
    expect(result.run.agentId).toBe('system-general');
    expect(result.run.status).toBe('streaming');
    expect(result.routerDecision.reason).toBe('fallback');
  });

  test('sendMessage routes via @mention', async () => {
    const thread = await chatService.createThread({
      title: 'Multi-agent',
      participantIds: ['system-general', 'system-creative'],
    });

    const result = await chatService.sendMessage(thread.id, {
      text: 'Hey @system-creative write me a poem',
    });

    expect(result.routerDecision.agentId).toBe('system-creative');
    expect(result.routerDecision.reason).toBe('mention');
    expect(result.run.agentId).toBe('system-creative');
  });

  test('sendMessage uses default agent when no mention', async () => {
    const thread = await chatService.createThread({
      title: 'Default',
      participantIds: ['system-general', 'system-creative'],
      defaultAgentId: 'system-creative',
    });

    const result = await chatService.sendMessage(thread.id, { text: 'Hello there' });

    expect(result.routerDecision.agentId).toBe('system-creative');
    expect(result.routerDecision.reason).toBe('default-agent');
  });

  test('sendMessage merges per-message tool overrides into the effective agent', async () => {
    let capturedToolState: Record<string, boolean> | undefined;
    (chatService as any).modelHandler = {
      stream(agent: { toolState: Record<string, boolean> }) {
        capturedToolState = agent.toolState;
        return { text: Promise.resolve('Hello') };
      },
    };

    const thread = await chatService.createThread({
      title: 'Tool overrides',
      participantIds: ['system-general'],
    });

    await chatService.sendMessage(thread.id, {
      text: 'Search for today\'s rate',
      toolOverrides: {
        web_search: true,
        code_interpreter: false,
      },
    });

    expect(capturedToolState).toEqual({
      web_search: true,
      code_interpreter: false,
    });
  });

  test('sendMessage throws for nonexistent thread', async () => {
    await expect(
      chatService.sendMessage('nonexistent', { text: 'hello' }),
    ).rejects.toThrow('Thread not found: nonexistent');
  });

  test('reply linkage enforces one-level depth', async () => {
    const thread = await chatService.createThread({
      title: 'Thread',
      participantIds: ['system-general'],
    });

    const first = await chatService.sendMessage(thread.id, { text: 'First' });

    const reply = await messageRepo.create({
      threadId: thread.id,
      role: 'assistant',
      content: 'Reply',
      parentMessageId: first.userMessage.id,
    });

    await expect(
      chatService.sendMessage(thread.id, {
        text: 'Deep reply',
        parentMessageId: reply.id,
      }),
    ).rejects.toThrow('Reply chains are limited to one level deep.');
  });

  test('reply routes to parent message agent via reply-context', async () => {
    const thread = await chatService.createThread({
      title: 'Reply thread',
      participantIds: ['system-general', 'system-creative'],
    });

    const parentMsg = await messageRepo.create({
      threadId: thread.id,
      role: 'assistant',
      content: 'I am creative',
      agentId: 'system-creative',
    });

    const result = await chatService.sendMessage(thread.id, {
      text: 'Reply to creative',
      parentMessageId: parentMsg.id,
    });

    expect(result.routerDecision.agentId).toBe('system-creative');
    expect(result.routerDecision.reason).toBe('reply-context');
  });

  test('sendMessage rejects reply parents from another thread', async () => {
    const threadA = await chatService.createThread({
      title: 'A',
      participantIds: ['system-general'],
    });
    const threadB = await chatService.createThread({
      title: 'B',
      participantIds: ['system-general'],
    });

    const parentMessage = await messageRepo.create({
      threadId: threadA.id,
      role: 'user',
      content: 'Thread A parent',
    });

    await expect(
      chatService.sendMessage(threadB.id, {
        text: 'Wrong thread',
        parentMessageId: parentMessage.id,
      }),
    ).rejects.toThrow(`Parent message ${parentMessage.id} does not belong to thread ${threadB.id}.`);
  });

  test('getMessages returns messages for thread', async () => {
    const thread = await chatService.createThread({
      title: 'Messages',
      participantIds: ['system-general'],
    });

    await chatService.sendMessage(thread.id, { text: 'First message' });
    await chatService.sendMessage(thread.id, { text: 'Second message' });

    const messages = await chatService.getMessages(thread.id);
    expect(messages.length).toBe(2);
    expect(messages[0].content).toBe('First message');
    expect(messages[1].content).toBe('Second message');
  });

  test('getSubthread returns the root message and ordered replies', async () => {
    const thread = await chatService.createThread({
      title: 'Subthread',
      participantIds: ['system-general'],
    });

    const parentMessage = await messageRepo.create({
      threadId: thread.id,
      role: 'user',
      content: 'Parent',
    });

    const firstReply = await messageRepo.create({
      threadId: thread.id,
      role: 'assistant',
      content: 'First reply',
      parentMessageId: parentMessage.id,
    });

    const secondReply = await messageRepo.create({
      threadId: thread.id,
      role: 'user',
      content: 'Second reply',
      parentMessageId: parentMessage.id,
    });

    const subthread = await chatService.getSubthread(thread.id, parentMessage.id);

    expect(subthread.parentMessage.id).toBe(parentMessage.id);
    expect(subthread.replies.map((reply) => reply.id)).toEqual([firstReply.id, secondReply.id]);
  });

  test('persistAssistantCompletion stores assistant tool invocations', async () => {
    const thread = await chatService.createThread({
      title: 'Tool persistence',
      participantIds: ['system-general'],
    });

    const persisted = await chatService.persistAssistantCompletion({
      threadId: thread.id,
      agentId: 'system-general',
      content: 'I searched the web for you.',
      toolInvocations: [
        {
          toolCallId: 'call-1',
          toolName: 'web_search',
          state: 'output-available',
          input: { query: 'usd brl today' },
          output: { results: [{ title: 'Wise', url: 'https://wise.com' }] },
        },
      ],
    });

    expect(persisted).not.toBeNull();

    const messages = await chatService.getMessages(thread.id);
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('assistant');
    expect(messages[0].toolInvocations).toEqual([
      {
        toolCallId: 'call-1',
        toolName: 'web_search',
        state: 'output-available',
        input: { query: 'usd brl today' },
        output: { results: [{ title: 'Wise', url: 'https://wise.com' }] },
        errorText: undefined,
        providerExecuted: undefined,
      },
    ]);
  });

  test('persistAssistantCompletion stores assistant message parts', async () => {
    const thread = await chatService.createThread({
      title: 'Image persistence',
      participantIds: ['system-general'],
    });

    const persisted = await chatService.persistAssistantCompletion({
      threadId: thread.id,
      agentId: 'system-general',
      content: "Here's your panda.",
      parts: [
        { type: 'text', text: "Here's your panda." },
        {
          type: 'image',
          url: 'data:image/png;base64,abc123',
          mimeType: 'image/png',
          name: 'panda.png',
          alt: 'Generated panda',
        },
      ],
    });

    expect(persisted).not.toBeNull();
    expect(persisted?.parts).toEqual([
      { type: 'text', text: "Here's your panda." },
      {
        type: 'image',
        url: 'data:image/png;base64,abc123',
        mimeType: 'image/png',
        name: 'panda.png',
        alt: 'Generated panda',
      },
    ]);

    const messages = await chatService.getMessages(thread.id);
    expect(messages[0].parts).toEqual([
      { type: 'text', text: "Here's your panda." },
      {
        type: 'image',
        url: 'data:image/png;base64,abc123',
        mimeType: 'image/png',
        name: 'panda.png',
        alt: 'Generated panda',
      },
    ]);
  });

  test('persistAssistantCompletion stores image-only assistant responses', async () => {
    const thread = await chatService.createThread({
      title: 'Image only persistence',
      participantIds: ['system-general'],
    });

    const persisted = await chatService.persistAssistantCompletion({
      threadId: thread.id,
      agentId: 'system-general',
      content: '',
      parts: [
        {
          type: 'image',
          url: 'data:image/png;base64,xyz987',
          mimeType: 'image/png',
          name: 'panda-only.png',
          alt: 'Generated panda only',
        },
      ],
    });

    expect(persisted).not.toBeNull();
    expect(persisted?.parts).toEqual([
      {
        type: 'image',
        url: 'data:image/png;base64,xyz987',
        mimeType: 'image/png',
        name: 'panda-only.png',
        alt: 'Generated panda only',
      },
    ]);
  });

  test('persistAssistantCompletion preserves parentMessageId for subthread replies', async () => {
    const thread = await chatService.createThread({
      title: 'Subthread persistence',
      participantIds: ['system-general'],
    });

    const parentMessage = await messageRepo.create({
      threadId: thread.id,
      role: 'user',
      content: 'Parent',
    });

    const persisted = await chatService.persistAssistantCompletion({
      threadId: thread.id,
      agentId: 'system-general',
      parentMessageId: parentMessage.id,
      content: 'Threaded assistant reply',
    });

    expect(persisted?.parentMessageId).toBe(parentMessage.id);

    const subthread = await chatService.getSubthread(thread.id, parentMessage.id);
    expect(subthread.replies.map((reply) => reply.id)).toContain(persisted!.id);
  });

  test('getMessages hydrates attachments from the attachment repository', async () => {
    const adapter = new SurrealDbAdapter(db);
    const threadRepo = new SurrealChatThreadRepository(adapter);
    const messageRepoWithAttachments = new SurrealChatMessageRepository(adapter);
    const runRepo = new SurrealChatRunRepository(adapter);
    const userAgentRepo = new SurrealUserAgentRepository(adapter);
    const attachmentRepo = new SurrealAttachmentRepository(adapter);
    const systemSource = new InMemorySystemSource([SYSTEM_GENERAL, SYSTEM_CREATIVE]);
    const catalogService = new AgentCatalogService(systemSource, userAgentRepo, MODEL_CARD_CATALOG);
    const registry = createMockRegistry();
    const modelHandler = new ModelHandler(registry);
    const attachmentAwareChatService = new ChatService(
      threadRepo,
      messageRepoWithAttachments,
      runRepo,
      catalogService,
      modelHandler,
      attachmentRepo,
      new FakeAttachmentResolver(async (attachment) => ({
        type: 'image',
        data: new Uint8Array(Buffer.from(attachment.inlineDataBase64!, 'base64')),
        mimeType: attachment.mimeType,
      })),
    );

    const thread = await attachmentAwareChatService.createThread({
      title: 'Hydrated attachments',
      participantIds: ['system-general'],
    });

    await attachmentAwareChatService.sendMessage(thread.id, {
      text: 'Preview this image',
      attachments: [{
        messageId: '',
        type: 'image',
        name: 'preview.png',
        mimeType: 'image/png',
        inlineDataBase64: Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64'),
        size: 4,
        lastModified: new Date().toISOString(),
        status: 'pending',
      }],
    });

    const messages = await attachmentAwareChatService.getMessages(thread.id);
    expect(messages).toHaveLength(1);
    expect(messages[0].attachments).toHaveLength(1);
    expect(messages[0].attachments[0].id).toBeString();
    expect(messages[0].attachments[0].inlineDataBase64).toBeDefined();
  });

  test('resolveParticipants throws when agent not found', async () => {
    const thread = await chatService.createThread({
      title: 'Bad Thread',
      participantIds: ['system-general'],
    });

    const updatedThread = {
      ...thread,
      participantIds: ['nonexistent-agent'],
    };

    const adapter = new SurrealDbAdapter(db);
    const threadRepo = new SurrealChatThreadRepository(adapter);
    await threadRepo.update(updatedThread);

    await expect(
      chatService.sendMessage(thread.id, { text: 'hello' }),
    ).rejects.toThrow('Participant agent not found: nonexistent-agent');
  });

  test('sendMessage includes full conversation history in model call', async () => {
    const capturingModel = createMockLanguageModel();

    const db2 = await createDbConnection({
      host: 'mem://',
      namespace: `test_ns_${crypto.randomUUID()}`,
      database: `test_db_${crypto.randomUUID()}`,
    });
    const adapter2 = new SurrealDbAdapter(db2);
    const threadRepo2 = new SurrealChatThreadRepository(adapter2);
    const messageRepo2 = new SurrealChatMessageRepository(adapter2);
    const runRepo2 = new SurrealChatRunRepository(adapter2);
    const userAgentRepo2 = new SurrealUserAgentRepository(adapter2);
    const systemSource2 = new InMemorySystemSource([SYSTEM_GENERAL]);
    const catalogService2 = new AgentCatalogService(systemSource2, userAgentRepo2, MODEL_CARD_CATALOG);
    const registry2 = createMockRegistry(capturingModel);
    const modelHandler2 = new ModelHandler(registry2);
    const svc = new ChatService(threadRepo2, messageRepo2, runRepo2, catalogService2, modelHandler2);

    const thread = await svc.createThread({ title: 'History', participantIds: ['system-general'] });

    // First message
    const r1 = await svc.sendMessage(thread.id, { text: 'Hello' });
    await r1.streamResult.text;
    // Wait for onFinish to persist the assistant response
    await new Promise((r) => setTimeout(r, 100));

    // Second message should include full history
    const r2 = await svc.sendMessage(thread.id, { text: 'How are you?' });
    await r2.streamResult.text;

    const calls = capturingModel.doStreamCalls;
    expect(calls.length).toBe(2);

    // First call: system prompt + 1 user message
    const firstPrompt = calls[0].prompt;
    const firstUserMsgs = firstPrompt.filter((m: any) => m.role === 'user');
    expect(firstUserMsgs.length).toBe(1);

    // Second call: system prompt + 3 messages (user:Hello, assistant:Hello, user:How are you?)
    const secondPrompt = calls[1].prompt;
    const secondNonSystemMsgs = secondPrompt.filter((m: any) => m.role !== 'system');
    expect(secondNonSystemMsgs.length).toBe(3);
    expect(secondNonSystemMsgs[0].role).toBe('user');
    expect(secondNonSystemMsgs[1].role).toBe('assistant');
    expect(secondNonSystemMsgs[2].role).toBe('user');

    await db2.close();
  });

  test('sendMessage persists assistant response after streaming completes', async () => {
    const db2 = await createDbConnection({
      host: 'mem://',
      namespace: `test_ns_${crypto.randomUUID()}`,
      database: `test_db_${crypto.randomUUID()}`,
    });
    const adapter2 = new SurrealDbAdapter(db2);
    const threadRepo2 = new SurrealChatThreadRepository(adapter2);
    const messageRepo2 = new SurrealChatMessageRepository(adapter2);
    const runRepo2 = new SurrealChatRunRepository(adapter2);
    const userAgentRepo2 = new SurrealUserAgentRepository(adapter2);
    const systemSource2 = new InMemorySystemSource([SYSTEM_GENERAL]);
    const catalogService2 = new AgentCatalogService(systemSource2, userAgentRepo2, MODEL_CARD_CATALOG);
    const registry2 = createMockRegistry();
    const modelHandler2 = new ModelHandler(registry2);
    const svc = new ChatService(threadRepo2, messageRepo2, runRepo2, catalogService2, modelHandler2);

    const thread = await svc.createThread({ title: 'Persist', participantIds: ['system-general'] });

    const result = await svc.sendMessage(thread.id, { text: 'Tell me something' });

    // Wait for stream to complete (triggers onFinish)
    await result.streamResult.text;
    // Small delay for async onFinish persistence
    await new Promise((r) => setTimeout(r, 100));

    const messages = await svc.getMessages(thread.id);
    expect(messages.length).toBe(2);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toBe('Tell me something');
    expect(messages[1].role).toBe('assistant');
    expect(messages[1].content).toBe('Hello');
    expect(messages[1].agentId).toBe('system-general');

    await db2.close();
  });

  test('sendMessage persists hosted tool invocations from response messages for all currently available tools', async () => {
    const db2 = await createDbConnection({
      host: 'mem://',
      namespace: `test_ns_${crypto.randomUUID()}`,
      database: `test_db_${crypto.randomUUID()}`,
    });
    const adapter2 = new SurrealDbAdapter(db2);
    const threadRepo2 = new SurrealChatThreadRepository(adapter2);
    const messageRepo2 = new SurrealChatMessageRepository(adapter2);
    const runRepo2 = new SurrealChatRunRepository(adapter2);
    const userAgentRepo2 = new SurrealUserAgentRepository(adapter2);
    const systemSource2 = new InMemorySystemSource([SYSTEM_GENERAL]);
    const catalogService2 = new AgentCatalogService(systemSource2, userAgentRepo2, MODEL_CARD_CATALOG);
    const registry2 = createMockRegistry();
    const modelHandler2 = new ModelHandler(registry2);
    const svc = new ChatService(threadRepo2, messageRepo2, runRepo2, catalogService2, modelHandler2);

    for (const fixture of HOSTED_TOOL_FIXTURES) {
      (svc as any).modelHandler = {
        stream(_agent: unknown, request: {
          onFinish?: (event: {
            text: string;
            finishReason: string;
            response: { messages: readonly unknown[] };
          }) => Promise<void> | void;
        }) {
          queueMicrotask(async () => {
            await request.onFinish?.({
              text: fixture.assistantText,
              finishReason: 'stop',
              response: { messages: fixture.responseMessages },
            });
          });

          return {
            text: Promise.resolve(fixture.assistantText),
          };
        },
      };

      const thread = await svc.createThread({
        title: `Persist ${fixture.toolName}`,
        participantIds: ['system-general'],
      });

      const result = await svc.sendMessage(thread.id, { text: `Run ${fixture.toolName}` });
      await result.streamResult.text;
      await new Promise((r) => setTimeout(r, 0));

      const messages = await svc.getMessages(thread.id);
      expect(messages).toHaveLength(2);
      expect(messages[1].role).toBe('assistant');
      expect(messages[1].content).toBe(fixture.assistantText);
      expect(messages[1].toolInvocations).toEqual([
        {
          toolCallId: fixture.toolCallId,
          toolName: fixture.toolName,
          state: 'output-available',
          input: fixture.input,
          output: fixture.output,
          errorText: undefined,
          providerExecuted: fixture.toolName === 'file_search' ? undefined : true,
        },
      ]);
    }

    await db2.close();
  });

  test('sendMessage updates run status to completed after streaming', async () => {
    const db2 = await createDbConnection({
      host: 'mem://',
      namespace: `test_ns_${crypto.randomUUID()}`,
      database: `test_db_${crypto.randomUUID()}`,
    });
    const adapter2 = new SurrealDbAdapter(db2);
    const threadRepo2 = new SurrealChatThreadRepository(adapter2);
    const messageRepo2 = new SurrealChatMessageRepository(adapter2);
    const runRepo2 = new SurrealChatRunRepository(adapter2);
    const userAgentRepo2 = new SurrealUserAgentRepository(adapter2);
    const systemSource2 = new InMemorySystemSource([SYSTEM_GENERAL]);
    const catalogService2 = new AgentCatalogService(systemSource2, userAgentRepo2, MODEL_CARD_CATALOG);
    const registry2 = createMockRegistry();
    const modelHandler2 = new ModelHandler(registry2);
    const svc = new ChatService(threadRepo2, messageRepo2, runRepo2, catalogService2, modelHandler2);

    const thread = await svc.createThread({ title: 'RunStatus', participantIds: ['system-general'] });

    const result = await svc.sendMessage(thread.id, { text: 'Check run' });
    expect(result.run.status).toBe('streaming');

    await result.streamResult.text;
    await new Promise((r) => setTimeout(r, 100));

    const updatedRun = await runRepo2.findById(result.run.id);
    expect(updatedRun).toBeDefined();
    expect(updatedRun!.status).toBe('completed');
    expect(updatedRun!.completedAt).toBeDefined();

    await db2.close();
  });

  test('multi-turn: second sendMessage sees persisted assistant response in history', async () => {
    const capturingModel = createMockLanguageModel();

    const db2 = await createDbConnection({
      host: 'mem://',
      namespace: `test_ns_${crypto.randomUUID()}`,
      database: `test_db_${crypto.randomUUID()}`,
    });
    const adapter2 = new SurrealDbAdapter(db2);
    const threadRepo2 = new SurrealChatThreadRepository(adapter2);
    const messageRepo2 = new SurrealChatMessageRepository(adapter2);
    const runRepo2 = new SurrealChatRunRepository(adapter2);
    const userAgentRepo2 = new SurrealUserAgentRepository(adapter2);
    const systemSource2 = new InMemorySystemSource([SYSTEM_GENERAL]);
    const catalogService2 = new AgentCatalogService(systemSource2, userAgentRepo2, MODEL_CARD_CATALOG);
    const registry2 = createMockRegistry(capturingModel);
    const modelHandler2 = new ModelHandler(registry2);
    const svc = new ChatService(threadRepo2, messageRepo2, runRepo2, catalogService2, modelHandler2);

    const thread = await svc.createThread({ title: 'MultiTurn', participantIds: ['system-general'] });

    // Turn 1: send + wait for onFinish persistence
    const r1 = await svc.sendMessage(thread.id, { text: 'First' });
    await r1.streamResult.text;
    await new Promise((r) => setTimeout(r, 100));

    // Turn 2: send — model should see [user:First, assistant:Hello, user:Second]
    const r2 = await svc.sendMessage(thread.id, { text: 'Second' });
    await r2.streamResult.text;

    const calls = capturingModel.doStreamCalls;
    expect(calls.length).toBe(2);

    const secondPrompt = calls[1].prompt;
    const nonSystemMsgs = secondPrompt.filter((m: any) => m.role !== 'system');
    expect(nonSystemMsgs.length).toBe(3);
    expect(nonSystemMsgs[0].role).toBe('user');
    expect(nonSystemMsgs[1].role).toBe('assistant');
    expect(nonSystemMsgs[2].role).toBe('user');

    await db2.close();
  });

  test('sendMessage includes inline image attachments in the model prompt', async () => {
    const capturingModel = createMockLanguageModel();

    const db2 = await createDbConnection({
      host: 'mem://',
      namespace: `test_ns_${crypto.randomUUID()}`,
      database: `test_db_${crypto.randomUUID()}`,
    });
    const adapter2 = new SurrealDbAdapter(db2);
    const threadRepo2 = new SurrealChatThreadRepository(adapter2);
    const messageRepo2 = new SurrealChatMessageRepository(adapter2);
    const runRepo2 = new SurrealChatRunRepository(adapter2);
    const userAgentRepo2 = new SurrealUserAgentRepository(adapter2);
    const systemSource2 = new InMemorySystemSource([SYSTEM_GENERAL]);
    const catalogService2 = new AgentCatalogService(systemSource2, userAgentRepo2, MODEL_CARD_CATALOG);
    const registry2 = createMockRegistry(capturingModel);
    const modelHandler2 = new ModelHandler(registry2);
    const resolver = new FakeAttachmentResolver(async (attachment) => ({
      type: 'image',
      data: new Uint8Array(Buffer.from(attachment.inlineDataBase64!, 'base64')),
      mimeType: attachment.mimeType,
    }));
    const svc = new ChatService(
      threadRepo2,
      messageRepo2,
      runRepo2,
      catalogService2,
      modelHandler2,
      undefined,
      resolver,
    );

    const thread = await svc.createThread({ title: 'Inline image', participantIds: ['system-general'] });

    const result = await svc.sendMessage(thread.id, {
      text: 'pls describe the image',
      attachments: [{
        messageId: '',
        type: 'image',
        name: 'screenshot.png',
        mimeType: 'image/png',
        inlineDataBase64: Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64'),
        size: 4,
        lastModified: new Date().toISOString(),
        status: 'pending',
      }],
    });
    await result.streamResult.text;

    const userPrompt = capturingModel.doStreamCalls[0].prompt.find((message: any) => message.role === 'user');
    expect(userPrompt).toBeDefined();
    expect(Array.isArray(userPrompt.content)).toBe(true);
    expect(userPrompt.content[0]).toEqual({ type: 'text', text: 'pls describe the image' });
    expect(userPrompt.content[1].type).not.toBe('text');
    expect(userPrompt.content).toHaveLength(2);

    await db2.close();
  });

  test('sendMessage rejects attachments that cannot be resolved before creating a run', async () => {
    const capturingModel = createMockLanguageModel();

    const db2 = await createDbConnection({
      host: 'mem://',
      namespace: `test_ns_${crypto.randomUUID()}`,
      database: `test_db_${crypto.randomUUID()}`,
    });
    const adapter2 = new SurrealDbAdapter(db2);
    const threadRepo2 = new SurrealChatThreadRepository(adapter2);
    const messageRepo2 = new SurrealChatMessageRepository(adapter2);
    const runRepo2 = new SurrealChatRunRepository(adapter2);
    const userAgentRepo2 = new SurrealUserAgentRepository(adapter2);
    const systemSource2 = new InMemorySystemSource([SYSTEM_GENERAL]);
    const catalogService2 = new AgentCatalogService(systemSource2, userAgentRepo2, MODEL_CARD_CATALOG);
    const registry2 = createMockRegistry(capturingModel);
    const modelHandler2 = new ModelHandler(registry2);
    const resolver = new FakeAttachmentResolver(async () => null, async () => false);
    const svc = new ChatService(
      threadRepo2,
      messageRepo2,
      runRepo2,
      catalogService2,
      modelHandler2,
      undefined,
      resolver,
    );

    const thread = await svc.createThread({ title: 'Broken image', participantIds: ['system-general'] });

    await expect(
      svc.sendMessage(thread.id, {
        text: 'describe this',
        attachments: [{
          messageId: '',
          type: 'image',
          name: 'screenshot.png',
          mimeType: 'image/png',
          path: 'screenshot.png',
          size: 4,
          lastModified: new Date().toISOString(),
          status: 'pending',
        }],
      }),
    ).rejects.toThrow('Attachments could not be resolved for model input');
    expect(capturingModel.doStreamCalls).toHaveLength(0);

    await db2.close();
  });

  test('sendMessage can stream with mixed resolved and rejected attachments', async () => {
    const capturingModel = createMockLanguageModel();

    const db2 = await createDbConnection({
      host: 'mem://',
      namespace: `test_ns_${crypto.randomUUID()}`,
      database: `test_db_${crypto.randomUUID()}`,
    });
    const adapter2 = new SurrealDbAdapter(db2);
    const threadRepo2 = new SurrealChatThreadRepository(adapter2);
    const messageRepo2 = new SurrealChatMessageRepository(adapter2);
    const runRepo2 = new SurrealChatRunRepository(adapter2);
    const userAgentRepo2 = new SurrealUserAgentRepository(adapter2);
    const systemSource2 = new InMemorySystemSource([SYSTEM_GENERAL]);
    const catalogService2 = new AgentCatalogService(systemSource2, userAgentRepo2, MODEL_CARD_CATALOG);
    const registry2 = createMockRegistry(capturingModel);
    const modelHandler2 = new ModelHandler(registry2);
    const resolver = new FakeAttachmentResolver(
      async (attachment) => attachment.name === 'usable.png'
        ? { type: 'image', data: new Uint8Array([1, 2, 3]), mimeType: attachment.mimeType }
        : null,
      async (attachment) => attachment.name === 'usable.png',
    );
    const svc = new ChatService(
      threadRepo2,
      messageRepo2,
      runRepo2,
      catalogService2,
      modelHandler2,
      undefined,
      resolver,
    );

    const thread = await svc.createThread({ title: 'Mixed image', participantIds: ['system-general'] });

    const result = await svc.sendMessage(thread.id, {
      text: 'look at the first image only',
      attachments: [
        {
          messageId: '',
          type: 'image',
          name: 'usable.png',
          mimeType: 'image/png',
          path: '/tmp/usable.png',
          size: 3,
          lastModified: new Date().toISOString(),
          status: 'pending',
        },
        {
          messageId: '',
          type: 'image',
          name: 'missing.png',
          mimeType: 'image/png',
          path: '/tmp/missing.png',
          size: 3,
          lastModified: new Date().toISOString(),
          status: 'pending',
        },
      ],
    });
    await result.streamResult.text;

    const userPrompt = capturingModel.doStreamCalls[0].prompt.find((message: any) => message.role === 'user');
    expect(Array.isArray(userPrompt.content)).toBe(true);
    expect(userPrompt.content.filter((part: any) => part.type !== 'text')).toHaveLength(1);
    expect(userPrompt.content).toHaveLength(2);

    await db2.close();
  });

  test('sendMessage rejects attachments when the runtime has no attachment resolver', async () => {
    const capturingModel = createMockLanguageModel();

    const db2 = await createDbConnection({
      host: 'mem://',
      namespace: `test_ns_${crypto.randomUUID()}`,
      database: `test_db_${crypto.randomUUID()}`,
    });
    const adapter2 = new SurrealDbAdapter(db2);
    const threadRepo2 = new SurrealChatThreadRepository(adapter2);
    const messageRepo2 = new SurrealChatMessageRepository(adapter2);
    const runRepo2 = new SurrealChatRunRepository(adapter2);
    const userAgentRepo2 = new SurrealUserAgentRepository(adapter2);
    const systemSource2 = new InMemorySystemSource([SYSTEM_GENERAL]);
    const catalogService2 = new AgentCatalogService(systemSource2, userAgentRepo2, MODEL_CARD_CATALOG);
    const registry2 = createMockRegistry(capturingModel);
    const modelHandler2 = new ModelHandler(registry2);
    const svc = new ChatService(threadRepo2, messageRepo2, runRepo2, catalogService2, modelHandler2);

    const thread = await svc.createThread({ title: 'No resolver', participantIds: ['system-general'] });

    await expect(
      svc.sendMessage(thread.id, {
        text: 'describe this',
        attachments: [{
          messageId: '',
          type: 'image',
          name: 'screenshot.png',
          mimeType: 'image/png',
          inlineDataBase64: Buffer.from([1, 2, 3]).toString('base64'),
          size: 3,
          lastModified: new Date().toISOString(),
          status: 'pending',
        }],
      }),
    ).rejects.toThrow('Attachments are not supported in this runtime.');
    expect(capturingModel.doStreamCalls).toHaveLength(0);

    await db2.close();
  });

  test('setThreadAgent persists defaultAgentId and keeps existing participants', async () => {
    const thread = await chatService.createThread({
      title: 'Default swap',
      participantIds: ['system-general', 'system-creative'],
    });

    const updated = await chatService.setThreadAgent(thread.id, 'system-creative');

    expect(updated.defaultAgentId).toBe('system-creative');
    expect(updated.participantIds).toEqual(['system-general', 'system-creative']);

    const reloaded = await chatService.getThread(thread.id);
    expect(reloaded?.defaultAgentId).toBe('system-creative');
    expect(reloaded?.participantIds).toEqual(['system-general', 'system-creative']);
  });

  test('setThreadAgent appends the agent to participants when it is missing and persists', async () => {
    const thread = await chatService.createThread({
      title: 'Add agent via setThreadAgent',
      participantIds: ['system-general'],
    });

    const updated = await chatService.setThreadAgent(thread.id, 'system-creative');

    expect(updated.participantIds).toEqual(['system-general', 'system-creative']);
    expect(updated.defaultAgentId).toBe('system-creative');

    const reloaded = await chatService.getThread(thread.id);
    expect(reloaded?.participantIds).toEqual(['system-general', 'system-creative']);
    expect(reloaded?.defaultAgentId).toBe('system-creative');
  });

  test('setThreadAgent throws when the thread does not exist', async () => {
    await expect(
      chatService.setThreadAgent('nonexistent', 'system-general'),
    ).rejects.toThrow('Thread not found: nonexistent');
  });

  test('setThreadAgent throws when the agent does not exist', async () => {
    const thread = await chatService.createThread({
      title: 'Missing agent',
      participantIds: ['system-general'],
    });

    await expect(
      chatService.setThreadAgent(thread.id, 'system-unknown'),
    ).rejects.toThrow('Agent not found: system-unknown');
  });

  test('addThreadParticipant appends agent to thread', async () => {
    const thread = await chatService.createThread({
      title: 'Add Test',
      participantIds: ['system-general'],
    });

    const updated = await chatService.addThreadParticipant(thread.id, 'system-creative');

    expect(updated.participantIds).toEqual(['system-general', 'system-creative']);
  });

  test('addThreadParticipant is idempotent for existing participant', async () => {
    const thread = await chatService.createThread({
      title: 'Idempotent',
      participantIds: ['system-general'],
    });

    const updated = await chatService.addThreadParticipant(thread.id, 'system-general');

    expect(updated.participantIds).toEqual(['system-general']);
  });

  test('addThreadParticipant throws for nonexistent agent', async () => {
    const thread = await chatService.createThread({
      title: 'Bad Agent',
      participantIds: ['system-general'],
    });

    await expect(
      chatService.addThreadParticipant(thread.id, 'nonexistent'),
    ).rejects.toThrow('Agent not found: nonexistent');
  });

  test('addThreadParticipant throws for nonexistent thread', async () => {
    await expect(
      chatService.addThreadParticipant('nonexistent', 'system-general'),
    ).rejects.toThrow('Thread not found: nonexistent');
  });

  test('removeThreadParticipant removes agent from thread', async () => {
    const thread = await chatService.createThread({
      title: 'Remove Test',
      participantIds: ['system-general', 'system-creative'],
    });

    const updated = await chatService.removeThreadParticipant(thread.id, 'system-creative');

    expect(updated.participantIds).toEqual(['system-general']);
  });

  test('removeThreadParticipant clears defaultAgentId if removed agent was default', async () => {
    const thread = await chatService.createThread({
      title: 'Default Remove',
      participantIds: ['system-general', 'system-creative'],
      defaultAgentId: 'system-creative',
    });

    const updated = await chatService.removeThreadParticipant(thread.id, 'system-creative');

    expect(updated.participantIds).toEqual(['system-general']);
    expect(updated.defaultAgentId).toBe('system-general');
  });

  test('removeThreadParticipant prevents removing last participant', async () => {
    const thread = await chatService.createThread({
      title: 'Last One',
      participantIds: ['system-general'],
    });

    await expect(
      chatService.removeThreadParticipant(thread.id, 'system-general'),
    ).rejects.toThrow('Thread must have at least one participant.');
  });

  test('removeThreadParticipant is no-op for non-participant agent', async () => {
    const thread = await chatService.createThread({
      title: 'No-op',
      participantIds: ['system-general'],
    });

    const updated = await chatService.removeThreadParticipant(thread.id, 'system-creative');

    expect(updated.participantIds).toEqual(['system-general']);
  });
});
