import { describe, test, expect, vi, beforeEach } from 'vitest';
import { flushSync } from 'svelte';
import { createChatPageModel } from './chat-page.svelte.ts';
import type { ChatTransport } from '$lib/adapters/chat/ChatTransport';
import type { ChatThread, ChatMessage, ResolvedAgentProfile } from 'domain/shared';
import { Gpt41ModelCard, Claude4SonnetModelCard } from 'domain/shared';

function makeThread(overrides: Partial<ChatThread> = {}): ChatThread {
	return {
		id: `thread-${crypto.randomUUID().slice(0, 8)}`,
		title: 'Test thread',
		participantIds: [],
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		...overrides,
	};
}

function makeAgent(overrides: Partial<ResolvedAgentProfile> = {}): ResolvedAgentProfile {
	return {
		id: `agent-${crypto.randomUUID().slice(0, 8)}`,
		name: 'General Assistant',
		description: 'A helpful assistant.',
		source: 'system',
		isInherited: false,
		isStandalone: true,
		isEditable: false,
		modelCard: Gpt41ModelCard,
		systemPrompt: 'You are helpful.',
		toolState: {},
		metadata: {},
		...overrides,
	};
}

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
	return {
		id: `msg-${crypto.randomUUID().slice(0, 8)}`,
		threadId: 'thread-1',
		role: 'user',
		content: 'Hello',
		attachments: [],
		createdAt: new Date().toISOString(),
		...overrides,
	};
}

function createMockTransport(overrides: Partial<ChatTransport> = {}): ChatTransport {
	return {
		listAgents: vi.fn<() => Promise<ResolvedAgentProfile[]>>().mockResolvedValue([]),
		listThreads: vi.fn<() => Promise<ChatThread[]>>().mockResolvedValue([]),
		createThread: vi.fn().mockResolvedValue(makeThread()),
		getThread: vi.fn().mockResolvedValue(null),
		deleteThread: vi.fn().mockResolvedValue(undefined),
		getMessages: vi.fn().mockResolvedValue([]),
		duplicateSystemAgent: vi.fn().mockResolvedValue(makeAgent()),
		...overrides,
	};
}

describe('createChatPageModel – loadInitial', () => {
	let transport: ChatTransport;

	beforeEach(() => {
		transport = createMockTransport();
	});

	test('both succeed: populates threads and agents', async () => {
		const threads = [makeThread({ title: 'Thread A' })];
		const agents = [
			makeAgent({ name: 'GPT Agent' }),
			makeAgent({ name: 'Claude Agent', modelCard: Claude4SonnetModelCard }),
		];
		transport = createMockTransport({
			listThreads: vi.fn().mockResolvedValue(threads),
			listAgents: vi.fn().mockResolvedValue(agents),
		});

		const model = createChatPageModel({ transport });
		await model.loadInitial();
		flushSync();

		expect(model.threads).toEqual(threads);
		expect(model.agents).toEqual(agents);
		expect(model.errorMessage).toBeNull();
		expect(model.hasLoaded).toBe(true);
		expect(model.isLoadingThreads).toBe(false);
		expect(model.isLoadingAgents).toBe(false);
	});

	test('both succeed: auto-selects first agent', async () => {
		const agents = [makeAgent({ id: 'agent-first' }), makeAgent({ id: 'agent-second' })];
		transport = createMockTransport({
			listAgents: vi.fn().mockResolvedValue(agents),
		});

		const model = createChatPageModel({ transport });
		await model.loadInitial();
		flushSync();

		expect(model.selectedAgentId).toBe('agent-first');
	});

	test('threads fail, agents succeed: agents still populated', async () => {
		const agents = [makeAgent({ name: 'GPT Agent' })];
		transport = createMockTransport({
			listThreads: vi.fn().mockRejectedValue(new Error('DB connection failed')),
			listAgents: vi.fn().mockResolvedValue(agents),
		});

		const model = createChatPageModel({ transport });
		await model.loadInitial();
		flushSync();

		expect(model.agents).toEqual(agents);
		expect(model.agents.length).toBe(1);
		expect(model.threads).toEqual([]);
		expect(model.errorMessage).toBe('DB connection failed');
		expect(model.hasLoaded).toBe(true);
		expect(model.selectedAgentId).toBe(agents[0].id);
	});

	test('agents fail, threads succeed: threads still populated', async () => {
		const threads = [makeThread({ title: 'Thread A' })];
		transport = createMockTransport({
			listThreads: vi.fn().mockResolvedValue(threads),
			listAgents: vi.fn().mockRejectedValue(new Error('Agent service down')),
		});

		const model = createChatPageModel({ transport });
		await model.loadInitial();
		flushSync();

		expect(model.threads).toEqual(threads);
		expect(model.agents).toEqual([]);
		expect(model.errorMessage).toBe('Agent service down');
		expect(model.hasLoaded).toBe(true);
	});

	test('both fail: shows combined error message', async () => {
		transport = createMockTransport({
			listThreads: vi.fn().mockRejectedValue(new Error('Threads down')),
			listAgents: vi.fn().mockRejectedValue(new Error('Agents down')),
		});

		const model = createChatPageModel({ transport });
		await model.loadInitial();
		flushSync();

		expect(model.threads).toEqual([]);
		expect(model.agents).toEqual([]);
		expect(model.errorMessage).toBe('Failed to load threads and agents.');
		expect(model.hasLoaded).toBe(true);
	});

	test('agents fail with non-Error rejection: shows fallback message', async () => {
		transport = createMockTransport({
			listAgents: vi.fn().mockRejectedValue('network timeout'),
		});

		const model = createChatPageModel({ transport });
		await model.loadInitial();
		flushSync();

		expect(model.errorMessage).toBe('Failed to load agents.');
	});

	test('threads fail with non-Error rejection: shows fallback message', async () => {
		transport = createMockTransport({
			listThreads: vi.fn().mockRejectedValue(42),
		});

		const model = createChatPageModel({ transport });
		await model.loadInitial();
		flushSync();

		expect(model.errorMessage).toBe('Failed to load threads.');
	});

	test('retry clears previous error and reloads', async () => {
		const agents = [makeAgent({ name: 'GPT Agent' })];
		const failingTransport = createMockTransport({
			listAgents: vi.fn().mockRejectedValue(new Error('Service unavailable')),
		});

		const model = createChatPageModel({ transport: failingTransport });
		await model.loadInitial();
		flushSync();

		expect(model.agents).toEqual([]);
		expect(model.errorMessage).toBe('Service unavailable');

		vi.mocked(failingTransport.listAgents).mockResolvedValue(agents);
		await model.loadInitial();
		flushSync();

		expect(model.agents).toEqual(agents);
		expect(model.errorMessage).toBeNull();
		expect(model.selectedAgentId).toBe(agents[0].id);
	});

	test('canCreateThread is false when agents are empty', async () => {
		transport = createMockTransport({
			listAgents: vi.fn().mockRejectedValue(new Error('fail')),
		});

		const model = createChatPageModel({ transport });
		await model.loadInitial();
		flushSync();

		expect(model.canCreateThread).toBe(false);
	});

	test('canCreateThread is true when agents loaded', async () => {
		transport = createMockTransport({
			listAgents: vi.fn().mockResolvedValue([makeAgent()]),
		});

		const model = createChatPageModel({ transport });
		await model.loadInitial();
		flushSync();

		expect(model.canCreateThread).toBe(true);
	});

	test('dismissError clears the error', async () => {
		transport = createMockTransport({
			listAgents: vi.fn().mockRejectedValue(new Error('fail')),
		});

		const model = createChatPageModel({ transport });
		await model.loadInitial();
		flushSync();

		expect(model.errorMessage).toBe('fail');
		model.dismissError();
		flushSync();
		expect(model.errorMessage).toBeNull();
	});
});

describe('createChatPageModel – createThread', () => {
	test('creates thread and selects it', async () => {
		const agents = [makeAgent({ id: 'agent-1' })];
		const createdThread = makeThread({ id: 'new-thread', title: 'My Thread' });
		const transport = createMockTransport({
			listAgents: vi.fn().mockResolvedValue(agents),
			createThread: vi.fn().mockResolvedValue(createdThread),
			getMessages: vi.fn().mockResolvedValue([]),
		});

		const model = createChatPageModel({ transport });
		await model.loadInitial();
		flushSync();

		await model.createThread('My Thread');
		flushSync();

		expect(transport.createThread).toHaveBeenCalledWith({
			title: 'My Thread',
			participantIds: ['agent-1'],
			defaultAgentId: 'agent-1',
		});
		expect(model.threads[0]).toEqual(createdThread);
		expect(model.activeThreadId).toBe('new-thread');
	});

	test('does nothing when agents are empty', async () => {
		const transport = createMockTransport({
			listAgents: vi.fn().mockResolvedValue([]),
		});

		const model = createChatPageModel({ transport });
		await model.loadInitial();
		flushSync();

		await model.createThread('My Thread');
		flushSync();

		expect(transport.createThread).not.toHaveBeenCalled();
		expect(model.errorMessage).toBe('No agents available. Cannot create a thread.');
	});

	test('shows error when createThread fails', async () => {
		const agents = [makeAgent({ id: 'agent-1' })];
		const transport = createMockTransport({
			listAgents: vi.fn().mockResolvedValue(agents),
			createThread: vi.fn().mockRejectedValue(new Error('Create failed')),
		});

		const model = createChatPageModel({ transport });
		await model.loadInitial();
		flushSync();

		await model.createThread('My Thread');
		flushSync();

		expect(model.errorMessage).toBe('Create failed');
		expect(model.threads).toEqual([]);
	});

	test('isCreatingThread is set during creation', async () => {
		const agents = [makeAgent({ id: 'agent-1' })];
		let resolveCreate!: (thread: ChatThread) => void;
		const createPromise = new Promise<ChatThread>((resolve) => {
			resolveCreate = resolve;
		});
		const transport = createMockTransport({
			listAgents: vi.fn().mockResolvedValue(agents),
			createThread: vi.fn().mockReturnValue(createPromise),
			getMessages: vi.fn().mockResolvedValue([]),
		});

		const model = createChatPageModel({ transport });
		await model.loadInitial();
		flushSync();

		const promise = model.createThread('My Thread');
		flushSync();

		expect(model.isCreatingThread).toBe(true);
		expect(model.canCreateThread).toBe(false);

		resolveCreate(makeThread({ id: 'new-thread' }));
		await promise;
		flushSync();

		expect(model.isCreatingThread).toBe(false);
		expect(model.canCreateThread).toBe(true);
	});
});

describe('createChatPageModel – selectThread', () => {
	test('sets active thread and loads messages', async () => {
		const thread = makeThread({ id: 'thread-1', title: 'Thread A' });
		const messages = [
			makeMessage({ id: 'msg-1', threadId: 'thread-1', role: 'user', content: 'Hello' }),
		];
		const transport = createMockTransport({
			listThreads: vi.fn().mockResolvedValue([thread]),
			listAgents: vi.fn().mockResolvedValue([makeAgent()]),
			getMessages: vi.fn().mockResolvedValue(messages),
		});

		const model = createChatPageModel({ transport });
		await model.loadInitial();
		flushSync();

		await model.selectThread('thread-1');
		flushSync();

		expect(model.activeThreadId).toBe('thread-1');
		expect(model.messages).toEqual(messages);
		expect(model.isLoadingMessages).toBe(false);
	});

	test('clears reply target on thread switch', async () => {
		const thread = makeThread({ id: 'thread-1' });
		const transport = createMockTransport({
			listThreads: vi.fn().mockResolvedValue([thread]),
			listAgents: vi.fn().mockResolvedValue([makeAgent()]),
			getMessages: vi.fn().mockResolvedValue([]),
		});

		const model = createChatPageModel({ transport });
		await model.loadInitial();
		flushSync();

		model.setReplyTarget(
			makeMessage({ id: 'msg-1', threadId: 'thread-1', role: 'user', content: 'Hey' }),
		);
		flushSync();
		expect(model.replyTarget).not.toBeNull();

		await model.selectThread('thread-1');
		flushSync();
		expect(model.replyTarget).toBeNull();
	});
});

describe('createChatPageModel – deleteThread', () => {
	test('removes thread and clears active state', async () => {
		const thread = makeThread({ id: 'thread-1', title: 'Thread A' });
		const transport = createMockTransport({
			listThreads: vi.fn().mockResolvedValue([thread]),
			listAgents: vi.fn().mockResolvedValue([makeAgent()]),
			getMessages: vi.fn().mockResolvedValue([]),
		});

		const model = createChatPageModel({ transport });
		await model.loadInitial();
		await model.selectThread('thread-1');
		flushSync();

		expect(model.activeThreadId).toBe('thread-1');

		await model.deleteThread('thread-1');
		flushSync();

		expect(model.threads).toEqual([]);
		expect(model.activeThreadId).toBeNull();
		expect(model.messages).toEqual([]);
	});

	test('removes non-active thread without clearing active state', async () => {
		const threads = [
			makeThread({ id: 'thread-1', title: 'Active' }),
			makeThread({ id: 'thread-2', title: 'Other' }),
		];
		const transport = createMockTransport({
			listThreads: vi.fn().mockResolvedValue(threads),
			listAgents: vi.fn().mockResolvedValue([makeAgent()]),
			getMessages: vi.fn().mockResolvedValue([]),
		});

		const model = createChatPageModel({ transport });
		await model.loadInitial();
		await model.selectThread('thread-1');
		flushSync();

		await model.deleteThread('thread-2');
		flushSync();

		expect(model.threads.length).toBe(1);
		expect(model.activeThreadId).toBe('thread-1');
	});
});

describe('createChatPageModel – agent selection and duplication', () => {
	test('selectAgent changes selectedAgentId', async () => {
		const agents = [makeAgent({ id: 'a-1' }), makeAgent({ id: 'a-2' })];
		const transport = createMockTransport({
			listAgents: vi.fn().mockResolvedValue(agents),
		});

		const model = createChatPageModel({ transport });
		await model.loadInitial();
		flushSync();

		expect(model.selectedAgentId).toBe('a-1');
		model.selectAgent('a-2');
		flushSync();
		expect(model.selectedAgentId).toBe('a-2');
	});

	test('duplicateAgent calls transport and adds result', async () => {
		const original = makeAgent({ id: 'system-1', source: 'system' });
		const duplicate = makeAgent({ id: 'user-dup', name: 'Copy', source: 'user' });
		const transport = createMockTransport({
			listAgents: vi.fn().mockResolvedValue([original]),
			duplicateSystemAgent: vi.fn().mockResolvedValue(duplicate),
		});

		const model = createChatPageModel({ transport });
		await model.loadInitial();
		flushSync();

		await model.duplicateAgent('system-1');
		flushSync();

		expect(transport.duplicateSystemAgent).toHaveBeenCalledWith('system-1');
		expect(model.agents.length).toBe(2);
		expect(model.agents[1]).toEqual(duplicate);
		expect(model.selectedAgentId).toBe('user-dup');
	});
});

describe('createChatPageModel – reply and send', () => {
	test('setReplyTarget and clearReply', async () => {
		const transport = createMockTransport();
		const model = createChatPageModel({ transport });

		const msg = makeMessage({ id: 'msg-1', threadId: 't', role: 'user', content: 'Hello' });
		model.setReplyTarget(msg);
		flushSync();
		expect(model.replyTarget).toEqual(msg);

		model.clearReply();
		flushSync();
		expect(model.replyTarget).toBeNull();
	});

	test('draft getter and setter', async () => {
		const transport = createMockTransport();
		const model = createChatPageModel({ transport });

		expect(model.draft).toBe('');
		model.draft = 'Hello world';
		flushSync();
		expect(model.draft).toBe('Hello world');
	});

	test('canSend is true when draft has text and not streaming', async () => {
		const transport = createMockTransport();
		const model = createChatPageModel({ transport });

		expect(model.canSend).toBe(false);
		model.draft = 'Hello';
		flushSync();
		expect(model.canSend).toBe(true);
	});

	test('canSend is false when draft is only whitespace', async () => {
		const transport = createMockTransport();
		const model = createChatPageModel({ transport });

		model.draft = '   ';
		flushSync();
		expect(model.canSend).toBe(false);
	});

	test('hasChatSessionMessages is false initially', async () => {
		const transport = createMockTransport();
		const model = createChatPageModel({ transport });

		expect(model.hasChatSessionMessages).toBe(false);
	});

	test('sendMessage does nothing without active thread', async () => {
		const transport = createMockTransport();
		const model = createChatPageModel({ transport });

		model.draft = 'Hello';
		flushSync();
		await model.sendMessage();
		flushSync();

		expect(model.draft).toBe('Hello');
	});

	test('sendMessage does nothing when draft is empty', async () => {
		const thread = makeThread({ id: 'thread-1' });
		const transport = createMockTransport({
			listThreads: vi.fn().mockResolvedValue([thread]),
			listAgents: vi.fn().mockResolvedValue([makeAgent()]),
			getMessages: vi.fn().mockResolvedValue([]),
		});

		const model = createChatPageModel({ transport });
		await model.loadInitial();
		await model.selectThread('thread-1');
		flushSync();

		model.draft = '';
		await model.sendMessage();
		flushSync();

		expect(model.draft).toBe('');
	});

	test('sendMessage clears draft and replyTarget', async () => {
		const thread = makeThread({ id: 'thread-1' });
		const transport = createMockTransport({
			listThreads: vi.fn().mockResolvedValue([thread]),
			listAgents: vi.fn().mockResolvedValue([makeAgent()]),
			getMessages: vi.fn().mockResolvedValue([]),
		});

		const model = createChatPageModel({ transport });
		await model.loadInitial();
		await model.selectThread('thread-1');
		flushSync();

		model.draft = 'Hello AI';
		model.setReplyTarget(
			makeMessage({ id: 'msg-1', threadId: 'thread-1', role: 'user', content: 'Prior msg' }),
		);
		flushSync();

		expect(model.draft).toBe('Hello AI');
		expect(model.replyTarget).not.toBeNull();

		await model.sendMessage();
		flushSync();

		expect(model.draft).toBe('');
		expect(model.replyTarget).toBeNull();
	});
});
