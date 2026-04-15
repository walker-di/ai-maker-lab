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
import { InMemorySystemSource, createMockRegistry } from './__test-helpers__/test-fixtures.js';

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
});
