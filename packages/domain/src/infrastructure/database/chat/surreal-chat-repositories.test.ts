import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { Surreal } from 'surrealdb';
import { createDbConnection } from '../client.js';
import { SurrealDbAdapter } from '../SurrealDbAdapter.js';
import { SurrealUserAgentRepository } from './SurrealUserAgentRepository.js';
import { SurrealChatThreadRepository } from './SurrealChatThreadRepository.js';
import { SurrealChatMessageRepository } from './SurrealChatMessageRepository.js';
import { SurrealChatRunRepository } from './SurrealChatRunRepository.js';
import { SurrealAttachmentRepository } from './SurrealAttachmentRepository.js';

describe('SurrealUserAgentRepository', () => {
  let db: Surreal;
  let repo: SurrealUserAgentRepository;

  beforeEach(async () => {
    db = await createDbConnection({
      host: 'mem://',
      namespace: `test_ns_${crypto.randomUUID()}`,
      database: `test_db_${crypto.randomUUID()}`,
    });
    repo = new SurrealUserAgentRepository(new SurrealDbAdapter(db));
  });

  afterEach(async () => { await db.close(); });

  test('creates and lists user agents', async () => {
    const agent = await repo.create({
      name: 'My Agent',
      description: 'custom agent',
      modelCardId: 'openai:gpt-4.1',
      systemPrompt: 'You are helpful.',
    });

    expect(agent.id).toBeString();
    expect(agent.source).toBe('user');
    expect(agent.modelCardId).toBe('openai:gpt-4.1');
    expect(agent.systemPrompt).toBe('You are helpful.');

    const agents = await repo.list();
    expect(agents.length).toBe(1);
    expect(agents[0].id).toBe(agent.id);
  });

  test('finds by id', async () => {
    const created = await repo.create({
      name: 'Test',
      description: 'desc',
      modelCardId: 'openai:gpt-4.1',
      systemPrompt: 'prompt',
    });

    const found = await repo.findById(created.id);
    expect(found).toBeDefined();
    expect(found!.modelCardId).toBe('openai:gpt-4.1');
  });

  test('returns null for unknown id', async () => {
    expect(await repo.findById('nonexistent')).toBeNull();
  });

  test('persists inheritsFromSystemAgentId', async () => {
    const agent = await repo.create({
      name: 'Inherited',
      description: 'inherited agent',
      modelCardId: 'openai:gpt-4.1',
      systemPrompt: 'prompt',
      inheritsFromSystemAgentId: 'system-general',
    });

    const found = await repo.findById(agent.id);
    expect(found!.inheritsFromSystemAgentId).toBe('system-general');
  });

  test('updates user agent fields', async () => {
    const agent = await repo.create({
      name: 'Original',
      description: 'original',
      modelCardId: 'openai:gpt-4.1',
      systemPrompt: 'original prompt',
    });

    const updated = await repo.update(agent.id, {
      systemPrompt: 'updated prompt',
      modelCardId: 'anthropic:claude-sonnet-4-20250514',
    });

    expect(updated.systemPrompt).toBe('updated prompt');
    expect(updated.modelCardId).toBe('anthropic:claude-sonnet-4-20250514');
  });

  test('removes user agent', async () => {
    const agent = await repo.create({
      name: 'Delete Me',
      description: 'will delete',
      modelCardId: 'openai:gpt-4.1',
      systemPrompt: 'prompt',
    });

    await repo.remove(agent.id);
    expect(await repo.findById(agent.id)).toBeNull();
    expect(await repo.list()).toEqual([]);
  });
});

describe('SurrealChatThreadRepository', () => {
  let db: Surreal;
  let repo: SurrealChatThreadRepository;

  beforeEach(async () => {
    db = await createDbConnection({
      host: 'mem://',
      namespace: `test_ns_${crypto.randomUUID()}`,
      database: `test_db_${crypto.randomUUID()}`,
    });
    repo = new SurrealChatThreadRepository(new SurrealDbAdapter(db));
  });

  afterEach(async () => { await db.close(); });

  test('creates and lists threads', async () => {
    const thread = await repo.create({
      title: 'Test Thread',
      participantIds: ['agent-1', 'agent-2'],
      defaultAgentId: 'agent-1',
    });

    expect(thread.id).toBeString();
    expect(thread.title).toBe('Test Thread');
    expect(thread.participantIds).toEqual(['agent-1', 'agent-2']);
    expect(thread.defaultAgentId).toBe('agent-1');

    const threads = await repo.list();
    expect(threads.length).toBe(1);
  });

  test('finds thread by id', async () => {
    const created = await repo.create({
      title: 'Find Me',
      participantIds: ['agent-1'],
    });

    const found = await repo.findById(created.id);
    expect(found).toBeDefined();
    expect(found!.title).toBe('Find Me');
  });

  test('updates thread', async () => {
    const thread = await repo.create({
      title: 'Original',
      participantIds: ['agent-1'],
    });

    const updated = await repo.update({
      ...thread,
      title: 'Updated Title',
      participantIds: ['agent-1', 'agent-2'],
    });

    expect(updated.title).toBe('Updated Title');

    const found = await repo.findById(thread.id);
    expect(found!.title).toBe('Updated Title');
    expect(found!.participantIds).toEqual(['agent-1', 'agent-2']);
  });

  test('removes thread', async () => {
    const thread = await repo.create({
      title: 'Delete Me',
      participantIds: ['agent-1'],
    });

    await repo.remove(thread.id);
    expect(await repo.findById(thread.id)).toBeNull();
  });
});

describe('SurrealChatMessageRepository', () => {
  let db: Surreal;
  let repo: SurrealChatMessageRepository;

  beforeEach(async () => {
    db = await createDbConnection({
      host: 'mem://',
      namespace: `test_ns_${crypto.randomUUID()}`,
      database: `test_db_${crypto.randomUUID()}`,
    });
    repo = new SurrealChatMessageRepository(new SurrealDbAdapter(db));
  });

  afterEach(async () => { await db.close(); });

  test('returns empty array from listByThread on fresh database', async () => {
    const messages = await repo.listByThread('nonexistent-thread');
    expect(messages).toEqual([]);
  });

  test('returns empty array from listReplies on fresh database', async () => {
    const replies = await repo.listReplies('nonexistent-parent');
    expect(replies).toEqual([]);
  });

  test('creates and lists messages by thread ordered by createdAt', async () => {
    await repo.create({
      threadId: 'thread-1',
      role: 'user',
      content: 'First message',
    });

    await repo.create({
      threadId: 'thread-1',
      role: 'assistant',
      content: 'Second message',
      agentId: 'agent-1',
    });

    await repo.create({
      threadId: 'thread-2',
      role: 'user',
      content: 'Other thread',
    });

    const messages = await repo.listByThread('thread-1');
    expect(messages.length).toBe(2);
    expect(messages[0].content).toBe('First message');
    expect(messages[1].content).toBe('Second message');
  });

  test('finds message by id', async () => {
    const msg = await repo.create({
      threadId: 'thread-1',
      role: 'user',
      content: 'Find me',
    });

    const found = await repo.findById(msg.id);
    expect(found).toBeDefined();
    expect(found!.content).toBe('Find me');
  });

  test('persists parentMessageId for reply linkage', async () => {
    const parent = await repo.create({
      threadId: 'thread-1',
      role: 'user',
      content: 'Parent',
    });

    const reply = await repo.create({
      threadId: 'thread-1',
      role: 'assistant',
      content: 'Reply',
      parentMessageId: parent.id,
    });

    expect(reply.parentMessageId).toBe(parent.id);

    const replies = await repo.listReplies(parent.id);
    expect(replies.length).toBe(1);
    expect(replies[0].content).toBe('Reply');
  });
});

describe('SurrealChatRunRepository', () => {
  let db: Surreal;
  let repo: SurrealChatRunRepository;

  beforeEach(async () => {
    db = await createDbConnection({
      host: 'mem://',
      namespace: `test_ns_${crypto.randomUUID()}`,
      database: `test_db_${crypto.randomUUID()}`,
    });
    repo = new SurrealChatRunRepository(new SurrealDbAdapter(db));
  });

  afterEach(async () => { await db.close(); });

  test('returns null from findByMessage on fresh database', async () => {
    const found = await repo.findByMessage('nonexistent-msg');
    expect(found).toBeNull();
  });

  test('creates and finds run by id', async () => {
    const run = await repo.create({
      threadId: 'thread-1',
      messageId: 'msg-1',
      agentId: 'agent-1',
      modelSnapshot: { registryId: 'openai:gpt-4.1', label: 'GPT-4.1' },
      status: 'streaming',
      startedAt: new Date().toISOString(),
    });

    expect(run.id).toBeString();
    expect(run.status).toBe('streaming');

    const found = await repo.findById(run.id);
    expect(found).toBeDefined();
    expect(found!.modelSnapshot.registryId).toBe('openai:gpt-4.1');
  });

  test('updates run status and usage', async () => {
    const run = await repo.create({
      threadId: 'thread-1',
      messageId: 'msg-1',
      agentId: 'agent-1',
      modelSnapshot: { registryId: 'openai:gpt-4.1', label: 'GPT-4.1' },
      status: 'streaming',
      startedAt: new Date().toISOString(),
    });

    const updated = await repo.update({
      ...run,
      status: 'completed',
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      finishReason: 'stop',
      completedAt: new Date().toISOString(),
    });

    expect(updated.status).toBe('completed');

    const found = await repo.findById(run.id);
    expect(found!.status).toBe('completed');
    expect(found!.usage).toEqual({ inputTokens: 100, outputTokens: 50, totalTokens: 150 });
    expect(found!.finishReason).toBe('stop');
  });

  test('finds run by message id', async () => {
    await repo.create({
      threadId: 'thread-1',
      messageId: 'msg-42',
      agentId: 'agent-1',
      modelSnapshot: { registryId: 'openai:gpt-4.1', label: 'GPT-4.1' },
      status: 'completed',
      startedAt: new Date().toISOString(),
    });

    const found = await repo.findByMessage('msg-42');
    expect(found).toBeDefined();
    expect(found!.messageId).toBe('msg-42');
  });
});

describe('SurrealAttachmentRepository', () => {
  let db: Surreal;
  let repo: SurrealAttachmentRepository;

  beforeEach(async () => {
    db = await createDbConnection({
      host: 'mem://',
      namespace: `test_ns_${crypto.randomUUID()}`,
      database: `test_db_${crypto.randomUUID()}`,
    });
    repo = new SurrealAttachmentRepository(new SurrealDbAdapter(db));
  });

  afterEach(async () => { await db.close(); });

  test('returns empty array from listByMessage on fresh database', async () => {
    const attachments = await repo.listByMessage('nonexistent-msg');
    expect(attachments).toEqual([]);
  });

  test('creates and lists attachments by message', async () => {
    const att = await repo.create({
      messageId: 'msg-1',
      type: 'image',
      name: 'photo.jpg',
      mimeType: 'image/jpeg',
      url: 'https://example.com/photo.jpg',
    });

    expect(att.id).toBeString();
    expect(att.type).toBe('image');

    await repo.create({
      messageId: 'msg-1',
      type: 'file',
      name: 'doc.pdf',
      mimeType: 'application/pdf',
    });

    await repo.create({
      messageId: 'msg-2',
      type: 'text',
      name: 'note.txt',
      mimeType: 'text/plain',
      content: 'Hello world',
    });

    const forMsg1 = await repo.listByMessage('msg-1');
    expect(forMsg1.length).toBe(2);

    const forMsg2 = await repo.listByMessage('msg-2');
    expect(forMsg2.length).toBe(1);
    expect(forMsg2[0].content).toBe('Hello world');
  });
});
