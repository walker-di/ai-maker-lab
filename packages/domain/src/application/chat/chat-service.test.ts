import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { Surreal } from 'surrealdb';
import type { SystemAgentDefinition } from '../../shared/chat/index.js';
import { Gpt41ModelCard, Claude4SonnetModelCard, MODEL_CARD_CATALOG } from '../../shared/chat/index.js';
import { createDbConnection } from '../../infrastructure/database/client.js';
import { SurrealDbAdapter } from '../../infrastructure/database/SurrealDbAdapter.js';
import { SurrealChatThreadRepository } from '../../infrastructure/database/chat/SurrealChatThreadRepository.js';
import { SurrealChatMessageRepository } from '../../infrastructure/database/chat/SurrealChatMessageRepository.js';
import { SurrealChatRunRepository } from '../../infrastructure/database/chat/SurrealChatRunRepository.js';
import { SurrealUserAgentRepository } from '../../infrastructure/database/chat/SurrealUserAgentRepository.js';
import { ModelHandler } from './model-handler.js';
import { AgentCatalogService } from './agent-catalog-service.js';
import { ChatService } from './chat-service.js';
import { InMemorySystemSource, createMockRegistry, createMockLanguageModel } from './__test-helpers__/test-fixtures.js';

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
});
