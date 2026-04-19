import { describe, test, expect, vi, beforeEach } from 'vitest';
import { flushSync } from 'svelte';
import { createChatPageModel } from './chat-page.svelte.ts';
import type { ChatTransport } from '$lib/adapters/chat/ChatTransport';
import type { ChatStreamFactory } from '$lib/adapters/chat/create-chat-stream-transport';
import type { AttachmentRef, ChatSubthread, ChatThread, ChatMessage, ResolvedAgentProfile } from 'domain/shared';
import { Gpt41ModelCard, Claude4SonnetModelCard } from 'domain/shared';

const aiSdkSvelteMock = vi.hoisted(() => {
	let nextMessageId = 1;
	const chats: Array<{
		messages: Array<{ id: string; role: string; parts: Array<{ type: string; text?: string }> }>;
		status: string;
		error: Error | null;
		lastSendOptions?: { body?: Record<string, unknown> };
		sendMessage: (
			message: { text: string },
			options?: { body?: Record<string, unknown> },
		) => void;
		stop: () => void;
		setMessages: (
			messages: Array<{ id: string; role: string; parts: Array<{ type: string; text?: string }> }>,
		) => void;
		finish: (result?: { text?: string; finishReason?: string }) => Promise<void>;
	}> = [];

	class MockChat {
		messages: Array<{ id: string; role: string; parts: Array<{ type: string; text?: string }> }> = [];
		status = 'ready';
		error: Error | null = null;
		config: { onFinish?: (result: { text: string; finishReason: string }) => Promise<void> | void };

		constructor(
			config: { onFinish?: (result: { text: string; finishReason: string }) => Promise<void> | void },
		) {
			this.config = config;
			chats.push(this);
		}

		lastSendOptions: { body?: Record<string, unknown> } | undefined;

		sendMessage(message: { text: string }, options?: { body?: Record<string, unknown> }) {
			this.messages = [
				...this.messages,
				{
					id: `session-${nextMessageId++}`,
					role: 'user',
					parts: [{ type: 'text', text: message.text }],
				},
			];
			this.lastSendOptions = options;
			this.status = 'submitted';
		}

		stop() {
			this.status = 'ready';
		}

		setMessages(
			messages: Array<{ id: string; role: string; parts: Array<{ type: string; text?: string }> }>,
		) {
			this.messages = messages;
		}

		async finish(result?: { text?: string; finishReason?: string }) {
			this.status = 'ready';
			await this.config.onFinish?.({
				text: result?.text ?? '',
				finishReason: result?.finishReason ?? 'stop',
			});
		}
	}

	return {
		MockChat,
		chats,
		reset() {
			chats.length = 0;
			nextMessageId = 1;
		},
	};
});

vi.mock('@ai-sdk/svelte', () => ({
	Chat: aiSdkSvelteMock.MockChat,
}));

beforeEach(() => {
	aiSdkSvelteMock.reset();
});

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
		toolsEnabled: true,
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
		toolInvocations: [],
		createdAt: new Date().toISOString(),
		...overrides,
	};
}

function makeSubthread(overrides: Partial<ChatSubthread> = {}): ChatSubthread {
	const parentMessage = overrides.parentMessage ?? makeMessage({ id: 'parent-1', content: 'Parent message' });
	return {
		parentMessage,
		replies: overrides.replies ?? [],
	};
}

function makeAttachment(overrides: Partial<AttachmentRef> = {}): AttachmentRef {
	return {
		id: `att-${crypto.randomUUID().slice(0, 8)}`,
		messageId: 'msg-1',
		type: 'image',
		name: 'preview.png',
		mimeType: 'image/png',
		path: '/tmp/preview.png',
		size: 1024,
		lastModified: new Date().toISOString(),
		status: 'ready',
		...overrides,
	};
}

function createMockStreamFactory(): ChatStreamFactory {
	return vi.fn().mockReturnValue({}) as unknown as ChatStreamFactory;
}

function createMockTransport(overrides: Partial<ChatTransport> = {}): ChatTransport {
	return {
		listAgents: vi.fn<() => Promise<ResolvedAgentProfile[]>>().mockResolvedValue([]),
		listThreads: vi.fn<() => Promise<ChatThread[]>>().mockResolvedValue([]),
		createThread: vi.fn().mockResolvedValue(makeThread()),
		getThread: vi.fn().mockResolvedValue(makeThread()),
		updateThreadTitle: vi.fn().mockResolvedValue(makeThread()),
		setThreadAgent: vi.fn().mockResolvedValue(makeThread()),
		addThreadParticipant: vi.fn().mockResolvedValue(makeThread()),
		removeThreadParticipant: vi.fn().mockResolvedValue(makeThread()),
		deleteThread: vi.fn().mockResolvedValue(undefined),
		getMessages: vi.fn().mockResolvedValue([]),
		getSubthread: vi.fn().mockResolvedValue(makeSubthread()),
		getAttachmentPreviewUrl: vi.fn().mockReturnValue(null),
		fetchAttachmentText: vi.fn().mockResolvedValue(''),
		duplicateSystemAgent: vi.fn().mockResolvedValue(makeAgent()),
		inheritSystemAgent: vi.fn().mockResolvedValue(makeAgent()),
		saveUserAgent: vi.fn().mockResolvedValue(makeAgent()),
		updateUserAgent: vi.fn().mockResolvedValue(makeAgent()),
		...overrides,
	};
}

function buildModel(
	transportOverrides: Partial<ChatTransport> = {},
	options: {
		initialAgentId?: string | null;
		initialThreadId?: string | null;
		onThreadChange?: (threadId: string | null) => void;
	} = {},
) {
	const transport = createMockTransport(transportOverrides);
	const streamFactory = createMockStreamFactory();
	const model = createChatPageModel({
		transport,
		streamFactory,
		initialAgentId: options.initialAgentId,
		initialThreadId: options.initialThreadId,
		onThreadChange: options.onThreadChange,
	});
	return { model, transport, streamFactory };
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
		const { model } = buildModel({
			listThreads: vi.fn().mockResolvedValue(threads),
			listAgents: vi.fn().mockResolvedValue(agents),
		});

		await model.loadInitial();
		flushSync();

		expect(model.threads).toEqual(threads);
		expect(model.agents).toEqual(agents);
		expect(model.errorMessage).toBeNull();
		expect(model.hasLoaded).toBe(true);
		expect(model.isLoadingThreads).toBe(false);
		expect(model.isLoadingAgents).toBe(false);
	});

	test('both succeed: auto-selects first agent as fallback', async () => {
		const agents = [makeAgent({ id: 'agent-first' }), makeAgent({ id: 'agent-second' })];
		const { model } = buildModel({
			listAgents: vi.fn().mockResolvedValue(agents),
		});

		await model.loadInitial();
		flushSync();

		expect(model.selectedAgentId).toBe('agent-first');
	});

	test('both succeed: honors initial agent handoff when present', async () => {
		const agents = [makeAgent({ id: 'agent-first' }), makeAgent({ id: 'agent-second' })];
		const { model } = buildModel(
			{
				listAgents: vi.fn().mockResolvedValue(agents),
			},
			{ initialAgentId: 'agent-second' },
		);

		await model.loadInitial();
		flushSync();

		expect(model.selectedAgentId).toBe('agent-second');
	});

	test('threads fail, agents succeed: agents still populated', async () => {
		const agents = [makeAgent({ name: 'GPT Agent' })];
		const { model } = buildModel({
			listThreads: vi.fn().mockRejectedValue(new Error('DB connection failed')),
			listAgents: vi.fn().mockResolvedValue(agents),
		});

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
		const { model } = buildModel({
			listThreads: vi.fn().mockResolvedValue(threads),
			listAgents: vi.fn().mockRejectedValue(new Error('Agent service down')),
		});

		await model.loadInitial();
		flushSync();

		expect(model.threads).toEqual(threads);
		expect(model.agents).toEqual([]);
		expect(model.errorMessage).toBe('Agent service down');
		expect(model.hasLoaded).toBe(true);
	});

	test('both fail: shows combined error message', async () => {
		const { model } = buildModel({
			listThreads: vi.fn().mockRejectedValue(new Error('Threads down')),
			listAgents: vi.fn().mockRejectedValue(new Error('Agents down')),
		});

		await model.loadInitial();
		flushSync();

		expect(model.threads).toEqual([]);
		expect(model.agents).toEqual([]);
		expect(model.errorMessage).toBe('Failed to load threads and agents.');
		expect(model.hasLoaded).toBe(true);
	});

	test('agents fail with non-Error rejection: shows fallback message', async () => {
		const { model } = buildModel({
			listAgents: vi.fn().mockRejectedValue('network timeout'),
		});

		await model.loadInitial();
		flushSync();

		expect(model.errorMessage).toBe('Failed to load agents.');
	});

	test('threads fail with non-Error rejection: shows fallback message', async () => {
		const { model } = buildModel({
			listThreads: vi.fn().mockRejectedValue(42),
		});

		await model.loadInitial();
		flushSync();

		expect(model.errorMessage).toBe('Failed to load threads.');
	});

	test('retry clears previous error and reloads', async () => {
		const agents = [makeAgent({ name: 'GPT Agent' })];
		const { model, transport: failingTransport } = buildModel({
			listAgents: vi.fn().mockRejectedValue(new Error('Service unavailable')),
		});

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
		const { model } = buildModel({
			listAgents: vi.fn().mockRejectedValue(new Error('fail')),
		});

		await model.loadInitial();
		flushSync();

		expect(model.canCreateThread).toBe(false);
	});

	test('canCreateThread is true when agents loaded', async () => {
		const { model } = buildModel({
			listAgents: vi.fn().mockResolvedValue([makeAgent()]),
		});

		await model.loadInitial();
		flushSync();

		expect(model.canCreateThread).toBe(true);
	});

	test('dismissError clears the error', async () => {
		const { model } = buildModel({
			listAgents: vi.fn().mockRejectedValue(new Error('fail')),
		});

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
		const { model, transport } = buildModel({
			listAgents: vi.fn().mockResolvedValue(agents),
			createThread: vi.fn().mockResolvedValue(createdThread),
			getThread: vi.fn().mockResolvedValue(createdThread),
			getMessages: vi.fn().mockResolvedValue([]),
		});

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

	test('uses the default placeholder when thread title is blank', async () => {
		const agents = [makeAgent({ id: 'agent-1' })];
		const now = new Date().toISOString();
		const createdThread = makeThread({
			id: 'new-thread',
			title: 'New conversation',
			createdAt: now,
			updatedAt: now,
		});
		const { model, transport } = buildModel({
			listAgents: vi.fn().mockResolvedValue(agents),
			createThread: vi.fn().mockResolvedValue(createdThread),
			getThread: vi.fn().mockResolvedValue(createdThread),
			getMessages: vi.fn().mockResolvedValue([]),
		});

		await model.loadInitial();
		flushSync();

		await model.createThread('   ');
		flushSync();

		expect(transport.createThread).toHaveBeenCalledWith({
			title: 'New conversation',
			participantIds: ['agent-1'],
			defaultAgentId: 'agent-1',
		});
		expect(model.threads[0].title).toBe('New conversation');
	});

	test('new thread uses the handed-off agent as the runtime default', async () => {
		const agents = [
			makeAgent({
				id: 'agent-system',
				modelCard: {
					...Gpt41ModelCard,
					nativeTools: ['web_search'],
				},
				toolState: {},
			}),
			makeAgent({
				id: 'agent-custom',
				source: 'user',
				isEditable: true,
				isStandalone: true,
				modelCard: {
					...Gpt41ModelCard,
					nativeTools: ['web_search'],
				},
				toolState: { web_search: true },
			}),
		];
		const createdThread = makeThread({
			id: 'new-thread',
			title: 'My Thread',
			participantIds: ['agent-custom'],
			defaultAgentId: 'agent-custom',
		});
		const { model, transport } = buildModel(
			{
				listAgents: vi.fn().mockResolvedValue(agents),
				createThread: vi.fn().mockResolvedValue(createdThread),
				getThread: vi.fn().mockResolvedValue(createdThread),
				getMessages: vi.fn().mockResolvedValue([]),
			},
			{ initialAgentId: 'agent-custom' },
		);

		await model.loadInitial();
		flushSync();
		await model.createThread('My Thread');
		flushSync();

		expect(transport.createThread).toHaveBeenCalledWith({
			title: 'My Thread',
			participantIds: ['agent-custom'],
			defaultAgentId: 'agent-custom',
		});
		expect(model.selectedAgentId).toBe('agent-custom');
		expect(model.hostedTools).toEqual([
			expect.objectContaining({ name: 'web_search', enabled: true }),
		]);
	});

	test('new thread clears stale tool overrides and restores the created thread runtime defaults', async () => {
		const agent = makeAgent({
			id: 'agent-1',
			modelCard: {
				...Gpt41ModelCard,
				nativeTools: ['web_search'],
			},
			toolState: {},
		});
		const existingThread = makeThread({
			id: 'thread-1',
			participantIds: ['agent-1'],
			defaultAgentId: 'agent-1',
		});
		const createdThread = makeThread({
			id: 'thread-2',
			participantIds: ['agent-1'],
			defaultAgentId: 'agent-1',
		});
		const getThread = vi
			.fn()
			.mockImplementation(async (threadId: string) => threadId === 'thread-1' ? existingThread : createdThread);
		const { model } = buildModel({
			listAgents: vi.fn().mockResolvedValue([agent]),
			listThreads: vi.fn().mockResolvedValue([existingThread]),
			getThread,
			getMessages: vi.fn().mockResolvedValue([]),
			createThread: vi.fn().mockResolvedValue(createdThread),
		});

		await model.loadInitial();
		await model.selectThread('thread-1');
		model.toggleTool('web_search', true);
		flushSync();
		expect(model.hostedTools[0].enabled).toBe(true);

		await model.createThread('Fresh Thread');
		flushSync();

		expect(model.activeThreadId).toBe('thread-2');
		expect(model.hostedTools).toEqual([
			expect.objectContaining({ name: 'web_search', enabled: true }),
		]);
	});

	test('does nothing when agents are empty', async () => {
		const { model, transport } = buildModel({
			listAgents: vi.fn().mockResolvedValue([]),
		});

		await model.loadInitial();
		flushSync();

		await model.createThread('My Thread');
		flushSync();

		expect(transport.createThread).not.toHaveBeenCalled();
		expect(model.errorMessage).toBe('No agents available. Cannot create a thread.');
	});

	test('shows error when createThread fails', async () => {
		const agents = [makeAgent({ id: 'agent-1' })];
		const { model } = buildModel({
			listAgents: vi.fn().mockResolvedValue(agents),
			createThread: vi.fn().mockRejectedValue(new Error('Create failed')),
		});

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
		const createdThread = makeThread({ id: 'new-thread' });
		const { model } = buildModel({
			listAgents: vi.fn().mockResolvedValue(agents),
			createThread: vi.fn().mockReturnValue(createPromise),
			getThread: vi.fn().mockResolvedValue(createdThread),
			getMessages: vi.fn().mockResolvedValue([]),
		});

		await model.loadInitial();
		flushSync();

		const promise = model.createThread('My Thread');
		flushSync();

		expect(model.isCreatingThread).toBe(true);
		expect(model.canCreateThread).toBe(false);

		resolveCreate(createdThread);
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
		const { model } = buildModel({
			listThreads: vi.fn().mockResolvedValue([thread]),
			listAgents: vi.fn().mockResolvedValue([makeAgent()]),
			getThread: vi.fn().mockResolvedValue(thread),
			getMessages: vi.fn().mockResolvedValue(messages),
		});

		await model.loadInitial();
		flushSync();

		await model.selectThread('thread-1');
		flushSync();

		expect(model.activeThreadId).toBe('thread-1');
		expect(model.messages).toEqual(messages);
		expect(model.isLoadingMessages).toBe(false);
	});

	test('handles stale thread by removing it from the list', async () => {
		const thread = makeThread({ id: 'stale-thread', title: 'Stale' });
		const { model } = buildModel({
			listThreads: vi.fn().mockResolvedValue([thread]),
			listAgents: vi.fn().mockResolvedValue([makeAgent()]),
			getThread: vi.fn().mockResolvedValue(null),
		});

		await model.loadInitial();
		flushSync();
		expect(model.threads.length).toBe(1);

		await model.selectThread('stale-thread');
		flushSync();

		expect(model.activeThreadId).toBeNull();
		expect(model.threads.length).toBe(0);
		expect(model.errorMessage).toBe('Thread not found. It may have been deleted.');
	});

	test('rolls back activeThreadId when getThread rejects', async () => {
		const thread = makeThread({ id: 'thread-1', title: 'Thread A' });
		const { model } = buildModel({
			listThreads: vi.fn().mockResolvedValue([thread]),
			listAgents: vi.fn().mockResolvedValue([makeAgent()]),
			getThread: vi.fn().mockRejectedValue(new Error('Network error')),
		});

		await model.loadInitial();
		flushSync();

		await model.selectThread('thread-1');
		flushSync();

		expect(model.activeThreadId).toBeNull();
		expect(model.isLoadingMessages).toBe(false);
		expect(model.errorMessage).toBe('Network error');
	});

	test('ignores stale getMessages when user switched threads', async () => {
		const threadA = makeThread({ id: 'thread-a', title: 'A' });
		const threadB = makeThread({ id: 'thread-b', title: 'B' });
		const msgsA = [makeMessage({ id: 'msg-a', threadId: 'thread-a', content: 'Hello A' })];
		const msgsB = [makeMessage({ id: 'msg-b', threadId: 'thread-b', content: 'Hello B' })];

		let resolveMessagesA!: (msgs: ChatMessage[]) => void;
		const messagesAPromise = new Promise<ChatMessage[]>((r) => { resolveMessagesA = r; });

		const getMessagesMock = vi.fn()
			.mockReturnValueOnce(messagesAPromise)
			.mockResolvedValueOnce(msgsB);

		const { model } = buildModel({
			listThreads: vi.fn().mockResolvedValue([threadA, threadB]),
			listAgents: vi.fn().mockResolvedValue([makeAgent()]),
			getThread: vi.fn().mockImplementation(async (id) =>
				id === 'thread-a' ? threadA : threadB,
			),
			getMessages: getMessagesMock,
		});

		await model.loadInitial();
		flushSync();

		const selectA = model.selectThread('thread-a');
		await model.selectThread('thread-b');
		flushSync();

		expect(model.activeThreadId).toBe('thread-b');
		expect(model.messages).toEqual(msgsB);

		resolveMessagesA(msgsA);
		await selectA;
		flushSync();

		expect(model.activeThreadId).toBe('thread-b');
		expect(model.messages).toEqual(msgsB);
	});

	test('surfaces getMessages failure as errorMessage', async () => {
		const thread = makeThread({ id: 'thread-1', title: 'Thread A' });
		const { model } = buildModel({
			listThreads: vi.fn().mockResolvedValue([thread]),
			listAgents: vi.fn().mockResolvedValue([makeAgent()]),
			getThread: vi.fn().mockResolvedValue(thread),
			getMessages: vi.fn().mockRejectedValue(new Error('Messages fetch failed')),
		});

		await model.loadInitial();
		flushSync();

		await model.selectThread('thread-1');
		flushSync();

		expect(model.activeThreadId).toBe('thread-1');
		expect(model.errorMessage).toBe('Messages fetch failed');
		expect(model.isLoadingMessages).toBe(false);
		expect(model.messages).toEqual([]);
	});
});

describe('createChatPageModel – onThreadChange callback', () => {
	test('fires with threadId on selectThread', async () => {
		const thread = makeThread({ id: 'thread-1' });
		const onThreadChange = vi.fn();
		const { model } = buildModel(
			{
				listThreads: vi.fn().mockResolvedValue([thread]),
				listAgents: vi.fn().mockResolvedValue([makeAgent()]),
				getThread: vi.fn().mockResolvedValue(thread),
				getMessages: vi.fn().mockResolvedValue([]),
			},
			{ onThreadChange },
		);

		await model.loadInitial();
		await model.selectThread('thread-1');
		flushSync();

		expect(onThreadChange).toHaveBeenCalledWith('thread-1');
	});

	test('fires with null on deleteThread of active thread', async () => {
		const thread = makeThread({ id: 'thread-1' });
		const onThreadChange = vi.fn();
		const { model } = buildModel(
			{
				listThreads: vi.fn().mockResolvedValue([thread]),
				listAgents: vi.fn().mockResolvedValue([makeAgent()]),
				getThread: vi.fn().mockResolvedValue(thread),
				getMessages: vi.fn().mockResolvedValue([]),
			},
			{ onThreadChange },
		);

		await model.loadInitial();
		await model.selectThread('thread-1');
		onThreadChange.mockClear();

		await model.deleteThread('thread-1');
		flushSync();

		expect(onThreadChange).toHaveBeenCalledWith(null);
	});

	test('does not fire on deleteThread of non-active thread', async () => {
		const threads = [
			makeThread({ id: 'thread-1' }),
			makeThread({ id: 'thread-2' }),
		];
		const onThreadChange = vi.fn();
		const { model } = buildModel(
			{
				listThreads: vi.fn().mockResolvedValue(threads),
				listAgents: vi.fn().mockResolvedValue([makeAgent()]),
				getThread: vi.fn().mockResolvedValue(threads[0]),
				getMessages: vi.fn().mockResolvedValue([]),
			},
			{ onThreadChange },
		);

		await model.loadInitial();
		await model.selectThread('thread-1');
		onThreadChange.mockClear();

		await model.deleteThread('thread-2');
		flushSync();

		expect(onThreadChange).not.toHaveBeenCalled();
	});

	test('fires with null when stale thread is detected', async () => {
		const thread = makeThread({ id: 'stale-thread' });
		const onThreadChange = vi.fn();
		const { model } = buildModel(
			{
				listThreads: vi.fn().mockResolvedValue([thread]),
				listAgents: vi.fn().mockResolvedValue([makeAgent()]),
				getThread: vi.fn().mockResolvedValue(null),
			},
			{ onThreadChange },
		);

		await model.loadInitial();
		await model.selectThread('stale-thread');
		flushSync();

		expect(onThreadChange).toHaveBeenCalledWith('stale-thread');
		expect(onThreadChange).toHaveBeenCalledWith(null);
	});

	test('fires with null when getThread rejects', async () => {
		const thread = makeThread({ id: 'thread-1' });
		const onThreadChange = vi.fn();
		const { model } = buildModel(
			{
				listThreads: vi.fn().mockResolvedValue([thread]),
				listAgents: vi.fn().mockResolvedValue([makeAgent()]),
				getThread: vi.fn().mockRejectedValue(new Error('fail')),
			},
			{ onThreadChange },
		);

		await model.loadInitial();
		await model.selectThread('thread-1');
		flushSync();

		expect(onThreadChange).toHaveBeenCalledWith('thread-1');
		expect(onThreadChange).toHaveBeenCalledWith(null);
	});
});

describe('createChatPageModel – initialThreadId', () => {
	test('auto-selects thread when initialThreadId matches a loaded thread', async () => {
		const thread = makeThread({ id: 'thread-1', title: 'Restored' });
		const messages = [makeMessage({ threadId: 'thread-1', content: 'Hello' })];
		const onThreadChange = vi.fn();
		const { model } = buildModel(
			{
				listThreads: vi.fn().mockResolvedValue([thread]),
				listAgents: vi.fn().mockResolvedValue([makeAgent()]),
				getThread: vi.fn().mockResolvedValue(thread),
				getMessages: vi.fn().mockResolvedValue(messages),
			},
			{ initialThreadId: 'thread-1', onThreadChange },
		);

		await model.loadInitial();
		flushSync();

		expect(model.activeThreadId).toBe('thread-1');
		expect(model.messages).toEqual(messages);
		expect(onThreadChange).toHaveBeenCalledWith('thread-1');
	});

	test('does nothing when initialThreadId does not match any loaded thread', async () => {
		const thread = makeThread({ id: 'thread-1' });
		const onThreadChange = vi.fn();
		const { model } = buildModel(
			{
				listThreads: vi.fn().mockResolvedValue([thread]),
				listAgents: vi.fn().mockResolvedValue([makeAgent()]),
			},
			{ initialThreadId: 'nonexistent', onThreadChange },
		);

		await model.loadInitial();
		flushSync();

		expect(model.activeThreadId).toBeNull();
		expect(onThreadChange).not.toHaveBeenCalled();
	});

	test('does nothing when initialThreadId is null', async () => {
		const thread = makeThread({ id: 'thread-1' });
		const onThreadChange = vi.fn();
		const { model } = buildModel(
			{
				listThreads: vi.fn().mockResolvedValue([thread]),
				listAgents: vi.fn().mockResolvedValue([makeAgent()]),
			},
			{ initialThreadId: null, onThreadChange },
		);

		await model.loadInitial();
		flushSync();

		expect(model.activeThreadId).toBeNull();
		expect(onThreadChange).not.toHaveBeenCalled();
	});
});

describe('createChatPageModel – deleteThread', () => {
	test('removes thread and clears active state', async () => {
		const thread = makeThread({ id: 'thread-1', title: 'Thread A' });
		const { model } = buildModel({
			listThreads: vi.fn().mockResolvedValue([thread]),
			listAgents: vi.fn().mockResolvedValue([makeAgent()]),
			getThread: vi.fn().mockResolvedValue(thread),
			getMessages: vi.fn().mockResolvedValue([]),
		});

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
		const { model } = buildModel({
			listThreads: vi.fn().mockResolvedValue(threads),
			listAgents: vi.fn().mockResolvedValue([makeAgent()]),
			getThread: vi.fn().mockResolvedValue(threads[0]),
			getMessages: vi.fn().mockResolvedValue([]),
		});

		await model.loadInitial();
		await model.selectThread('thread-1');
		flushSync();

		await model.deleteThread('thread-2');
		flushSync();

		expect(model.threads.length).toBe(1);
		expect(model.activeThreadId).toBe('thread-1');
	});
});

describe('createChatPageModel – agent selection and default agent', () => {
	test('selectAgent changes fallback selectedAgentId', async () => {
		const agents = [makeAgent({ id: 'a-1' }), makeAgent({ id: 'a-2' })];
		const { model } = buildModel({
			listAgents: vi.fn().mockResolvedValue(agents),
		});

		await model.loadInitial();
		flushSync();

		expect(model.selectedAgentId).toBe('a-1');
		model.selectAgent('a-2');
		flushSync();
		expect(model.selectedAgentId).toBe('a-2');
	});

	test('setDefaultAgent updates thread default agent when a thread is active', async () => {
		const agents = [makeAgent({ id: 'a-1' }), makeAgent({ id: 'a-2' })];
		const thread = makeThread({ id: 'thread-1', defaultAgentId: 'a-1', participantIds: ['a-1'] });
		const updatedThread = makeThread({
			id: 'thread-1',
			defaultAgentId: 'a-2',
			participantIds: ['a-1', 'a-2'],
		});
		const { model, transport } = buildModel({
			listAgents: vi.fn().mockResolvedValue(agents),
			listThreads: vi.fn().mockResolvedValue([thread]),
			getThread: vi.fn().mockResolvedValue(thread),
			getMessages: vi.fn().mockResolvedValue([]),
			setThreadAgent: vi.fn().mockResolvedValue(updatedThread),
		});

		await model.loadInitial();
		await model.selectThread('thread-1');
		flushSync();

		await model.setDefaultAgent('a-2');
		flushSync();

		expect(transport.setThreadAgent).toHaveBeenCalledWith('thread-1', 'a-2');
	});

	test('setDefaultAgent does not call transport when no thread is active', async () => {
		const agents = [makeAgent({ id: 'a-1' }), makeAgent({ id: 'a-2' })];
		const { model, transport } = buildModel({
			listAgents: vi.fn().mockResolvedValue(agents),
		});

		await model.loadInitial();
		flushSync();

		await model.setDefaultAgent('a-2');
		flushSync();

		expect(transport.setThreadAgent).not.toHaveBeenCalled();
		expect(model.selectedAgentId).toBe('a-2');
	});

	test('selectThread derives selectedAgentId from thread defaultAgentId', async () => {
		const agents = [makeAgent({ id: 'a-1' }), makeAgent({ id: 'a-2' })];
		const thread = makeThread({ id: 'thread-1', defaultAgentId: 'a-2', participantIds: ['a-2'] });
		const { model } = buildModel({
			listAgents: vi.fn().mockResolvedValue(agents),
			listThreads: vi.fn().mockResolvedValue([thread]),
			getThread: vi.fn().mockResolvedValue(thread),
			getMessages: vi.fn().mockResolvedValue([]),
		});

		await model.loadInitial();
		flushSync();
		expect(model.selectedAgentId).toBe('a-1');

		await model.selectThread('thread-1');
		flushSync();
		expect(model.selectedAgentId).toBe('a-2');
	});

	test('defaultAgent is null when no agents and no thread', async () => {
		const { model } = buildModel({
			listAgents: vi.fn().mockResolvedValue([]),
		});

		await model.loadInitial();
		flushSync();

		expect(model.defaultAgent).toBeNull();
		expect(model.selectedAgentId).toBeNull();
	});

	test('defaultAgent falls back to first participant when thread has no defaultAgentId', async () => {
		const agents = [makeAgent({ id: 'a-1' }), makeAgent({ id: 'a-2' })];
		const thread = makeThread({ id: 'thread-1', participantIds: ['a-2', 'a-1'] });
		const { model } = buildModel({
			listAgents: vi.fn().mockResolvedValue(agents),
			listThreads: vi.fn().mockResolvedValue([thread]),
			getThread: vi.fn().mockResolvedValue(thread),
			getMessages: vi.fn().mockResolvedValue([]),
		});

		await model.loadInitial();
		await model.selectThread('thread-1');
		flushSync();

		expect(model.defaultAgent?.id).toBe('a-2');
	});

	test('duplicateAgent calls transport and adds result without changing selection', async () => {
		const original = makeAgent({ id: 'system-1', source: 'system' });
		const duplicate = makeAgent({ id: 'user-dup', name: 'Copy', source: 'user' });
		const { model, transport } = buildModel({
			listAgents: vi.fn().mockResolvedValue([original]),
			duplicateSystemAgent: vi.fn().mockResolvedValue(duplicate),
		});

		await model.loadInitial();
		flushSync();

		await model.duplicateAgent('system-1');
		flushSync();

		expect(transport.duplicateSystemAgent).toHaveBeenCalledWith('system-1');
		expect(model.agents.length).toBe(2);
		expect(model.agents[1]).toEqual(duplicate);
		expect(model.selectedAgentId).toBe('system-1');
	});
});

describe('createChatPageModel – inheritAgent', () => {
	test('inheritAgent calls transport and adds result', async () => {
		const original = makeAgent({ id: 'system-1', source: 'system' });
		const inherited = makeAgent({
			id: 'user-inherited',
			name: 'Inherited Agent',
			source: 'user',
			isInherited: true,
			isStandalone: false,
			isEditable: true,
			inheritsFromSystemAgentId: 'system-1',
		});
		const { model, transport } = buildModel({
			listAgents: vi.fn().mockResolvedValue([original]),
			inheritSystemAgent: vi.fn().mockResolvedValue(inherited),
		});

		await model.loadInitial();
		flushSync();

		await model.inheritAgent('system-1');
		flushSync();

		expect(transport.inheritSystemAgent).toHaveBeenCalledWith('system-1');
		expect(model.agents.length).toBe(2);
		expect(model.agents[1]).toEqual(inherited);
		expect(model.selectedAgentId).toBe('system-1');
	});

	test('inheritAgent shows error on failure', async () => {
		const original = makeAgent({ id: 'system-1', source: 'system' });
		const { model } = buildModel({
			listAgents: vi.fn().mockResolvedValue([original]),
			inheritSystemAgent: vi.fn().mockRejectedValue(new Error('System agent not found')),
		});

		await model.loadInitial();
		flushSync();

		await model.inheritAgent('system-1');
		flushSync();

		expect(model.errorMessage).toBe('System agent not found');
		expect(model.agents.length).toBe(1);
	});
});

describe('createChatPageModel – saveUserAgent', () => {
	test('saveUserAgent creates new agent without changing selection', async () => {
		const existing = makeAgent({ id: 'system-1', source: 'system' });
		const saved = makeAgent({
			id: 'user-new',
			name: 'My Custom Agent',
			source: 'user',
			isEditable: true,
			isStandalone: true,
		});
		const { model, transport } = buildModel({
			listAgents: vi.fn().mockResolvedValue([existing]),
			saveUserAgent: vi.fn().mockResolvedValue(saved),
		});

		await model.loadInitial();
		flushSync();

		await model.saveUserAgent({
			name: 'My Custom Agent',
			description: 'A custom agent.',
			modelCardId: Gpt41ModelCard.registryId,
			systemPrompt: 'You are custom.',
		});
		flushSync();

		expect(transport.saveUserAgent).toHaveBeenCalledWith({
			name: 'My Custom Agent',
			description: 'A custom agent.',
			modelCardId: Gpt41ModelCard.registryId,
			systemPrompt: 'You are custom.',
		});
		expect(model.agents.length).toBe(2);
		expect(model.selectedAgentId).toBe('system-1');
	});
});

describe('createChatPageModel – updateUserAgent', () => {
	test('updateUserAgent replaces agent in list', async () => {
		const userAgent = makeAgent({
			id: 'user-1',
			name: 'Old Name',
			source: 'user',
			isEditable: true,
		});
		const updated = makeAgent({
			id: 'user-1',
			name: 'New Name',
			source: 'user',
			isEditable: true,
		});
		const { model, transport } = buildModel({
			listAgents: vi.fn().mockResolvedValue([userAgent]),
			updateUserAgent: vi.fn().mockResolvedValue(updated),
		});

		await model.loadInitial();
		flushSync();

		await model.updateUserAgent('user-1', { systemPrompt: 'Updated prompt' });
		flushSync();

		expect(transport.updateUserAgent).toHaveBeenCalledWith('user-1', {
			systemPrompt: 'Updated prompt',
		});
		expect(model.agents.length).toBe(1);
		expect(model.agents[0].name).toBe('New Name');
	});

	test('updateUserAgent shows error on failure', async () => {
		const userAgent = makeAgent({ id: 'user-1', source: 'user', isEditable: true });
		const { model } = buildModel({
			listAgents: vi.fn().mockResolvedValue([userAgent]),
			updateUserAgent: vi.fn().mockRejectedValue(new Error('Update failed')),
		});

		await model.loadInitial();
		flushSync();

		await model.updateUserAgent('user-1', { systemPrompt: 'new' });
		flushSync();

		expect(model.errorMessage).toBe('Update failed');
	});
});

describe('createChatPageModel – reply and send', () => {
	test('openSubthread and closeSubthread', async () => {
		const thread = makeThread({ id: 'thread-1' });
		const parentMessage = makeMessage({ id: 'msg-1', threadId: 'thread-1', role: 'user', content: 'Hello' });
		const reply = makeMessage({
			id: 'reply-1',
			threadId: 'thread-1',
			role: 'assistant',
			content: 'Reply',
			parentMessageId: parentMessage.id,
		});
		const { model } = buildModel({
			listThreads: vi.fn().mockResolvedValue([thread]),
			listAgents: vi.fn().mockResolvedValue([makeAgent()]),
			getThread: vi.fn().mockResolvedValue(thread),
			getMessages: vi.fn().mockResolvedValue([parentMessage, reply]),
			getSubthread: vi.fn().mockResolvedValue(
				makeSubthread({ parentMessage, replies: [reply] }),
			),
		});

		await model.loadInitial();
		await model.selectThread('thread-1');
		await model.openSubthread(parentMessage);
		flushSync();

		expect(model.isSubthreadOpen).toBe(true);
		expect(model.activeSubthread?.parentMessage).toEqual(parentMessage);
		expect(model.activeSubthreadReplies).toEqual([reply]);

		model.closeSubthread();
		flushSync();
		expect(model.isSubthreadOpen).toBe(false);
	});

	test('draft getter and setter', async () => {
		const { model } = buildModel();

		expect(model.draft).toBe('');
		model.draft = 'Hello world';
		flushSync();
		expect(model.draft).toBe('Hello world');
	});

	test('canSend is true when draft has text and not streaming', async () => {
		const { model } = buildModel();

		expect(model.canSend).toBe(false);
		model.draft = 'Hello';
		flushSync();
		expect(model.canSend).toBe(true);
	});

	test('canSend is false when draft is only whitespace', async () => {
		const { model } = buildModel();

		model.draft = '   ';
		flushSync();
		expect(model.canSend).toBe(false);
	});

	test('hasChatSessionMessages is false initially', async () => {
		const { model } = buildModel();

		expect(model.hasChatSessionMessages).toBe(false);
	});

	test('timelineMessages keep only root messages and expose reply summaries', async () => {
		const thread = makeThread({ id: 'thread-1' });
		const rootMessage = makeMessage({ id: 'root-1', threadId: 'thread-1', content: 'Root' });
		const reply = makeMessage({
			id: 'reply-1',
			threadId: 'thread-1',
			role: 'assistant',
			content: 'Reply',
			parentMessageId: rootMessage.id,
		});
		const { model } = buildModel({
			listThreads: vi.fn().mockResolvedValue([thread]),
			listAgents: vi.fn().mockResolvedValue([makeAgent()]),
			getThread: vi.fn().mockResolvedValue(thread),
			getMessages: vi.fn().mockResolvedValue([rootMessage, reply]),
		});

		await model.loadInitial();
		await model.selectThread('thread-1');
		flushSync();

		expect(model.timelineMessages).toEqual([rootMessage]);
		expect(model.getReplySummary(rootMessage.id)).toEqual({
			parentMessageId: rootMessage.id,
			replyCount: 1,
			latestReply: reply,
			participantNames: ['Agent'],
		});
	});

	test('sendMessage does nothing without active thread', async () => {
		const { model } = buildModel();

		model.draft = 'Hello';
		flushSync();
		await model.sendMessage();
		flushSync();

		expect(model.draft).toBe('Hello');
	});

	test('sendMessage does nothing when draft is empty', async () => {
		const thread = makeThread({ id: 'thread-1' });
		const { model } = buildModel({
			listThreads: vi.fn().mockResolvedValue([thread]),
			listAgents: vi.fn().mockResolvedValue([makeAgent()]),
			getThread: vi.fn().mockResolvedValue(thread),
			getMessages: vi.fn().mockResolvedValue([]),
		});

		await model.loadInitial();
		await model.selectThread('thread-1');
		flushSync();

		model.draft = '';
		await model.sendMessage();
		flushSync();

		expect(model.draft).toBe('');
	});

	test('sendMessage clears the main draft', async () => {
		const thread = makeThread({ id: 'thread-1' });
		const { model } = buildModel({
			listThreads: vi.fn().mockResolvedValue([thread]),
			listAgents: vi.fn().mockResolvedValue([makeAgent()]),
			getThread: vi.fn().mockResolvedValue(thread),
			getMessages: vi.fn().mockResolvedValue([]),
		});

		await model.loadInitial();
		await model.selectThread('thread-1');
		flushSync();

		model.draft = 'Hello AI';

		await model.sendMessage();
		flushSync();

		expect(model.draft).toBe('');
		expect(model.timelineSessionMessages).toHaveLength(1);
		expect(model.activeSubthreadSessionMessages).toHaveLength(0);
	});

	test('sendMessage includes tool overrides in the stream body', async () => {
		const thread = makeThread({ id: 'thread-1' });
		const agent = makeAgent({
			id: 'agent-1',
			modelCard: {
				...Gpt41ModelCard,
				nativeTools: ['web_search', 'code_interpreter'],
			},
			toolState: { code_interpreter: true },
		});
		const { model } = buildModel({
			listThreads: vi.fn().mockResolvedValue([thread]),
			listAgents: vi.fn().mockResolvedValue([agent]),
			getThread: vi.fn().mockResolvedValue(thread),
			getMessages: vi.fn().mockResolvedValue([]),
		});

		await model.loadInitial();
		await model.selectThread('thread-1');
		model.toggleTool('web_search', true);
		model.toggleTool('code_interpreter', false);
		model.draft = 'Use search please';
		flushSync();

		await model.sendMessage();
		flushSync();

		const activeChat = aiSdkSvelteMock.chats.at(-1);
		expect(activeChat?.lastSendOptions).toEqual({
			body: {
				toolOverrides: {
					web_search: true,
					code_interpreter: false,
				},
			},
		});
	});

	test('sendSubthreadMessage keeps session messages out of the main timeline', async () => {
		const thread = makeThread({ id: 'thread-1' });
		const parentMessage = makeMessage({ id: 'msg-1', threadId: 'thread-1', content: 'Parent' });
		const { model } = buildModel({
			listThreads: vi.fn().mockResolvedValue([thread]),
			listAgents: vi.fn().mockResolvedValue([makeAgent()]),
			getThread: vi.fn().mockResolvedValue(thread),
			getMessages: vi.fn().mockResolvedValue([parentMessage]),
			getSubthread: vi.fn().mockResolvedValue(makeSubthread({ parentMessage })),
		});

		await model.loadInitial();
		await model.selectThread('thread-1');
		await model.openSubthread(parentMessage);
		flushSync();

		model.subthreadDraft = 'Thread reply';
		await model.sendSubthreadMessage();
		flushSync();

		expect(model.subthreadDraft).toBe('');
		expect(model.timelineSessionMessages).toHaveLength(0);
		expect(model.activeSubthreadSessionMessages).toHaveLength(1);
	});

	test('sendSubthreadMessage sends with parentMessageId in the stream body so the server persists a reply', async () => {
		const thread = makeThread({ id: 'thread-1' });
		const parentMessage = makeMessage({ id: 'parent-1', threadId: 'thread-1', content: 'Parent' });
		const { model } = buildModel({
			listThreads: vi.fn().mockResolvedValue([thread]),
			listAgents: vi.fn().mockResolvedValue([makeAgent()]),
			getThread: vi.fn().mockResolvedValue(thread),
			getMessages: vi.fn().mockResolvedValue([parentMessage]),
			getSubthread: vi.fn().mockResolvedValue(makeSubthread({ parentMessage })),
		});

		await model.loadInitial();
		await model.selectThread('thread-1');
		await model.openSubthread(parentMessage);
		flushSync();

		model.subthreadDraft = 'Threaded reply';
		await model.sendSubthreadMessage();
		flushSync();

		const subthreadChat = aiSdkSvelteMock.chats.at(-1);
		expect(subthreadChat?.lastSendOptions?.body).toMatchObject({
			parentMessageId: 'parent-1',
		});
	});

	test('openSubthread fetches the subthread via the transport and populates replies', async () => {
		const thread = makeThread({ id: 'thread-1' });
		const parentMessage = makeMessage({
			id: 'parent-1',
			threadId: 'thread-1',
			role: 'user',
			content: 'Parent',
		});
		const replyA = makeMessage({
			id: 'reply-a',
			threadId: 'thread-1',
			role: 'assistant',
			content: 'A reply',
			parentMessageId: parentMessage.id,
		});
		const replyB = makeMessage({
			id: 'reply-b',
			threadId: 'thread-1',
			role: 'user',
			content: 'Another reply',
			parentMessageId: parentMessage.id,
		});

		const getSubthread = vi.fn().mockResolvedValue(
			makeSubthread({ parentMessage, replies: [replyA, replyB] }),
		);
		const { model, transport } = buildModel({
			listThreads: vi.fn().mockResolvedValue([thread]),
			listAgents: vi.fn().mockResolvedValue([makeAgent()]),
			getThread: vi.fn().mockResolvedValue(thread),
			getMessages: vi.fn().mockResolvedValue([parentMessage, replyA, replyB]),
			getSubthread,
		});

		await model.loadInitial();
		await model.selectThread('thread-1');
		await model.openSubthread(parentMessage);
		flushSync();

		expect(transport.getSubthread).toHaveBeenCalledWith('thread-1', 'parent-1');
		expect(model.isSubthreadOpen).toBe(true);
		expect(model.activeSubthread?.parentMessage).toEqual(parentMessage);
		expect(model.activeSubthreadReplies.map((reply) => reply.id)).toEqual([
			'reply-a',
			'reply-b',
		]);
	});

	test('openSubthread is a no-op when invoked on a reply message (threads are one level deep)', async () => {
		const thread = makeThread({ id: 'thread-1' });
		const parentMessage = makeMessage({
			id: 'parent-1',
			threadId: 'thread-1',
			role: 'user',
			content: 'Parent',
		});
		const reply = makeMessage({
			id: 'reply-1',
			threadId: 'thread-1',
			role: 'assistant',
			content: 'Reply',
			parentMessageId: parentMessage.id,
		});
		const getSubthread = vi.fn().mockResolvedValue(makeSubthread({ parentMessage, replies: [reply] }));
		const { model, transport } = buildModel({
			listThreads: vi.fn().mockResolvedValue([thread]),
			listAgents: vi.fn().mockResolvedValue([makeAgent()]),
			getThread: vi.fn().mockResolvedValue(thread),
			getMessages: vi.fn().mockResolvedValue([parentMessage, reply]),
			getSubthread,
		});

		await model.loadInitial();
		await model.selectThread('thread-1');
		flushSync();

		await model.openSubthread(reply);
		flushSync();

		expect(transport.getSubthread).not.toHaveBeenCalled();
		expect(model.isSubthreadOpen).toBe(false);
		expect(model.activeSubthread).toBeNull();
	});

	test('blank-title thread gets renamed from the first message', async () => {
		const now = new Date().toISOString();
		const createdThread = makeThread({
			id: 'thread-1',
			title: 'New conversation',
			createdAt: now,
			updatedAt: now,
		});
		const renamedThread = {
			...createdThread,
			title: 'Quarterly planning notes',
			updatedAt: new Date(Date.now() + 1_000).toISOString(),
		};
		const { model, transport } = buildModel({
			listAgents: vi.fn().mockResolvedValue([makeAgent({ id: 'agent-1' })]),
			createThread: vi.fn().mockResolvedValue(createdThread),
			getThread: vi.fn().mockResolvedValue(createdThread),
			getMessages: vi.fn().mockResolvedValue([]),
			updateThreadTitle: vi.fn().mockResolvedValue(renamedThread),
		});

		await model.loadInitial();
		await model.createThread('');
		flushSync();

		model.draft = '  "Quarterly   planning\nnotes"  ';
		await model.sendMessage();
		flushSync();

		expect(transport.updateThreadTitle).toHaveBeenCalledWith(
			'thread-1',
			'Quarterly planning notes',
		);
		expect(model.threads[0].title).toBe('Quarterly planning notes');
	});

	test('manual thread titles are preserved on first send', async () => {
		const createdThread = makeThread({
			id: 'thread-1',
			title: 'Release checklist',
		});
		const { model, transport } = buildModel({
			listAgents: vi.fn().mockResolvedValue([makeAgent({ id: 'agent-1' })]),
			createThread: vi.fn().mockResolvedValue(createdThread),
			getThread: vi.fn().mockResolvedValue(createdThread),
			getMessages: vi.fn().mockResolvedValue([]),
			updateThreadTitle: vi.fn().mockResolvedValue(createdThread),
		});

		await model.loadInitial();
		await model.createThread('Release checklist');
		flushSync();

		model.draft = 'First prompt should not replace my custom title';
		await model.sendMessage();
		flushSync();

		expect(transport.updateThreadTitle).not.toHaveBeenCalled();
		expect(model.threads[0].title).toBe('Release checklist');
	});

	test('auto-generated titles are truncated for sidebar readability', async () => {
		const now = new Date().toISOString();
		const createdThread = makeThread({
			id: 'thread-1',
			title: 'New conversation',
			createdAt: now,
			updatedAt: now,
		});
		const longFirstMessage = 'a'.repeat(90);
		const expectedTitle = `${'a'.repeat(69)}...`;
		const renamedThread = {
			...createdThread,
			title: expectedTitle,
			updatedAt: new Date(Date.now() + 1_000).toISOString(),
		};
		const { model, transport } = buildModel({
			listAgents: vi.fn().mockResolvedValue([makeAgent({ id: 'agent-1' })]),
			createThread: vi.fn().mockResolvedValue(createdThread),
			getThread: vi.fn().mockResolvedValue(createdThread),
			getMessages: vi.fn().mockResolvedValue([]),
			updateThreadTitle: vi.fn().mockResolvedValue(renamedThread),
		});

		await model.loadInitial();
		await model.createThread('');
		flushSync();

		model.draft = longFirstMessage;
		await model.sendMessage();
		flushSync();

		expect(transport.updateThreadTitle).toHaveBeenCalledWith('thread-1', expectedTitle);
		expect(model.threads[0].title).toBe(expectedTitle);
	});

	test('attachment-only first sends fall back to the first attachment name', async () => {
		const now = new Date().toISOString();
		const createdThread = makeThread({
			id: 'thread-1',
			title: 'New conversation',
			createdAt: now,
			updatedAt: now,
		});
		const renamedThread = {
			...createdThread,
			title: 'notes.md',
			updatedAt: new Date(Date.now() + 1_000).toISOString(),
		};
		const { model, transport } = buildModel({
			listAgents: vi.fn().mockResolvedValue([makeAgent({ id: 'agent-1' })]),
			createThread: vi.fn().mockResolvedValue(createdThread),
			getThread: vi.fn().mockResolvedValue(createdThread),
			getMessages: vi.fn().mockResolvedValue([]),
			updateThreadTitle: vi.fn().mockResolvedValue(renamedThread),
		});

		await model.loadInitial();
		await model.createThread('');
		flushSync();

		model.addFiles([new File(['hello'], 'notes.md', { type: 'text/markdown' })]);
		await model.sendMessage();
		flushSync();

		expect(transport.updateThreadTitle).toHaveBeenCalledWith('thread-1', 'notes.md');
		expect(model.threads[0].title).toBe('notes.md');
	});

	test('onFinish clears session messages after persisted refresh when IDs differ', async () => {
		const thread = makeThread({ id: 'thread-1' });
		const agent = makeAgent({ id: 'agent-1' });
		const initialMessages = [
			makeMessage({ id: 'msg-old-user', threadId: 'thread-1', role: 'user', content: 'Earlier' }),
		];
		const refreshedMessages = [
			...initialMessages,
			makeMessage({ id: 'db-user-1', threadId: 'thread-1', role: 'user', content: 'Hello AI' }),
			makeMessage({
				id: 'db-assistant-1',
				threadId: 'thread-1',
				role: 'assistant',
				content: 'Hi there',
				agentId: 'agent-1',
			}),
		];
		const getMessages = vi.fn()
			.mockResolvedValueOnce(initialMessages)
			.mockResolvedValueOnce(refreshedMessages);
		const { model, streamFactory } = buildModel({
			listThreads: vi.fn().mockResolvedValue([thread]),
			listAgents: vi.fn().mockResolvedValue([agent]),
			getThread: vi.fn().mockResolvedValue(thread),
			getMessages,
		});

		await model.loadInitial();
		await model.selectThread('thread-1');
		flushSync();

		model.draft = 'Hello AI';
		await model.sendMessage();
		flushSync();

		expect(model.hasChatSessionMessages).toBe(true);
		expect(model.chatMessages).toHaveLength(1);

		const activeChat = aiSdkSvelteMock.chats.at(-1);
		expect(activeChat).toBeDefined();

		activeChat!.setMessages([
			{ id: 'session-user-1', role: 'user', parts: [{ type: 'text', text: 'Hello AI' }] },
			{
				id: 'session-assistant-1',
				role: 'assistant',
				parts: [{ type: 'text', text: 'Hi there' }],
			},
		]);

		await activeChat!.finish({ text: 'Hi there', finishReason: 'stop' });
		flushSync();

		expect(getMessages).toHaveBeenCalledTimes(2);
		expect(model.messages).toEqual(refreshedMessages);
		expect(model.chatMessages).toEqual([]);
		expect(model.hasChatSessionMessages).toBe(false);
		expect(vi.mocked(streamFactory)).toHaveBeenCalledTimes(2);
	});
});

describe('createChatPageModel – attachment preview', () => {
	test('uses inline data URLs for image previews', async () => {
		const thread = makeThread({ id: 'thread-1' });
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);

		try {
			const { model } = buildModel({
				listThreads: vi.fn().mockResolvedValue([thread]),
				listAgents: vi.fn().mockResolvedValue([makeAgent()]),
				getThread: vi.fn().mockResolvedValue(thread),
				getMessages: vi.fn().mockResolvedValue([]),
			});
			const attachment = makeAttachment({
				inlineDataBase64: 'iVBORw0KGgo=',
			});

			await model.loadInitial();
			await model.selectThread('thread-1');
			await model.openAttachmentPreview(attachment);
			flushSync();

			expect(model.attachmentPreviewOpen).toBe(true);
			expect(model.attachmentPreviewKind).toBe('image');
			expect(model.attachmentPreviewUrl).toBe('data:image/png;base64,iVBORw0KGgo=');
			expect(fetchMock).not.toHaveBeenCalled();
		} finally {
			vi.unstubAllGlobals();
		}
	});

	test('loads text previews from the attachment route when inline data is absent', async () => {
		const thread = makeThread({ id: 'thread-1' });
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			text: async () => 'Hello from preview',
		});
		vi.stubGlobal('fetch', fetchMock);

		try {
			const { model } = buildModel({
				listThreads: vi.fn().mockResolvedValue([thread]),
				listAgents: vi.fn().mockResolvedValue([makeAgent()]),
				getThread: vi.fn().mockResolvedValue(thread),
				getMessages: vi.fn().mockResolvedValue([]),
			});
			const attachment = makeAttachment({
				id: 'att-text',
				type: 'text',
				name: 'notes.txt',
				mimeType: 'text/plain',
				path: '/tmp/notes.txt',
			});

			await model.loadInitial();
			await model.selectThread('thread-1');
			await model.openAttachmentPreview(attachment);
			flushSync();

			expect(fetchMock).toHaveBeenCalledWith('/api/chat/threads/thread-1/attachments/att-text');
			expect(model.attachmentPreviewKind).toBe('text');
			expect(model.attachmentPreviewText).toBe('Hello from preview');
			expect(model.isLoadingAttachmentPreview).toBe(false);
		} finally {
			vi.unstubAllGlobals();
		}
	});

	test('closeAttachmentPreview clears preview state', async () => {
		const thread = makeThread({ id: 'thread-1' });
		const { model } = buildModel({
			listThreads: vi.fn().mockResolvedValue([thread]),
			listAgents: vi.fn().mockResolvedValue([makeAgent()]),
			getThread: vi.fn().mockResolvedValue(thread),
			getMessages: vi.fn().mockResolvedValue([]),
		});
		const attachment = makeAttachment({
			inlineDataBase64: 'iVBORw0KGgo=',
		});

		await model.loadInitial();
		await model.selectThread('thread-1');
		await model.openAttachmentPreview(attachment);
		flushSync();
		expect(model.attachmentPreviewOpen).toBe(true);

		model.closeAttachmentPreview();
		flushSync();

		expect(model.attachmentPreviewOpen).toBe(false);
		expect(model.previewedAttachment).toBeNull();
		expect(model.attachmentPreviewUrl).toBeNull();
	});
});

describe('createChatPageModel – thread participant management', () => {
	test('threadParticipants derives from activeThread participantIds', async () => {
		const agents = [makeAgent({ id: 'a-1' }), makeAgent({ id: 'a-2' }), makeAgent({ id: 'a-3' })];
		const thread = makeThread({ id: 'thread-1', participantIds: ['a-1', 'a-3'] });
		const { model } = buildModel({
			listAgents: vi.fn().mockResolvedValue(agents),
			listThreads: vi.fn().mockResolvedValue([thread]),
			getThread: vi.fn().mockResolvedValue(thread),
			getMessages: vi.fn().mockResolvedValue([]),
		});

		await model.loadInitial();
		await model.selectThread('thread-1');
		flushSync();

		expect(model.threadParticipants.length).toBe(2);
		expect(model.threadParticipants.map((p) => p.id)).toEqual(['a-1', 'a-3']);
	});

	test('threadParticipants is empty when no thread is active', async () => {
		const agents = [makeAgent({ id: 'a-1' })];
		const { model } = buildModel({
			listAgents: vi.fn().mockResolvedValue(agents),
		});

		await model.loadInitial();
		flushSync();

		expect(model.threadParticipants).toEqual([]);
	});

	test('addAgentToThread calls transport and updates thread', async () => {
		const agents = [makeAgent({ id: 'a-1' }), makeAgent({ id: 'a-2' })];
		const thread = makeThread({ id: 'thread-1', participantIds: ['a-1'] });
		const updatedThread = makeThread({ id: 'thread-1', participantIds: ['a-1', 'a-2'] });
		const { model, transport } = buildModel({
			listAgents: vi.fn().mockResolvedValue(agents),
			listThreads: vi.fn().mockResolvedValue([thread]),
			getThread: vi.fn().mockResolvedValue(thread),
			getMessages: vi.fn().mockResolvedValue([]),
			addThreadParticipant: vi.fn().mockResolvedValue(updatedThread),
		});

		await model.loadInitial();
		await model.selectThread('thread-1');
		flushSync();

		await model.addAgentToThread('a-2');
		flushSync();

		expect(transport.addThreadParticipant).toHaveBeenCalledWith('thread-1', 'a-2');
		expect(model.threadParticipants.length).toBe(2);
	});

	test('addAgentToThread does nothing without active thread', async () => {
		const { model, transport } = buildModel({
			listAgents: vi.fn().mockResolvedValue([makeAgent()]),
		});

		await model.loadInitial();
		flushSync();

		await model.addAgentToThread('a-1');
		expect(transport.addThreadParticipant).not.toHaveBeenCalled();
	});

	test('removeAgentFromThread calls transport and updates thread', async () => {
		const agents = [makeAgent({ id: 'a-1' }), makeAgent({ id: 'a-2' })];
		const thread = makeThread({ id: 'thread-1', participantIds: ['a-1', 'a-2'], defaultAgentId: 'a-1' });
		const updatedThread = makeThread({ id: 'thread-1', participantIds: ['a-1'], defaultAgentId: 'a-1' });
		const { model, transport } = buildModel({
			listAgents: vi.fn().mockResolvedValue(agents),
			listThreads: vi.fn().mockResolvedValue([thread]),
			getThread: vi.fn().mockResolvedValue(thread),
			getMessages: vi.fn().mockResolvedValue([]),
			removeThreadParticipant: vi.fn().mockResolvedValue(updatedThread),
		});

		await model.loadInitial();
		await model.selectThread('thread-1');
		flushSync();

		await model.removeAgentFromThread('a-2');
		flushSync();

		expect(transport.removeThreadParticipant).toHaveBeenCalledWith('thread-1', 'a-2');
		expect(model.threadParticipants.length).toBe(1);
	});

	test('removeAgentFromThread updates defaultAgent based on thread state', async () => {
		const agents = [makeAgent({ id: 'a-1' }), makeAgent({ id: 'a-2' })];
		const thread = makeThread({ id: 'thread-1', participantIds: ['a-1', 'a-2'], defaultAgentId: 'a-2' });
		const updatedThread = makeThread({ id: 'thread-1', participantIds: ['a-1'], defaultAgentId: 'a-1' });
		const { model } = buildModel({
			listAgents: vi.fn().mockResolvedValue(agents),
			listThreads: vi.fn().mockResolvedValue([thread]),
			getThread: vi.fn().mockResolvedValue(thread),
			getMessages: vi.fn().mockResolvedValue([]),
			removeThreadParticipant: vi.fn().mockResolvedValue(updatedThread),
		});

		await model.loadInitial();
		await model.selectThread('thread-1');
		flushSync();
		expect(model.selectedAgentId).toBe('a-2');

		await model.removeAgentFromThread('a-2');
		flushSync();

		expect(model.selectedAgentId).toBe('a-1');
	});
});

describe('createChatPageModel – multi-agent thread creation', () => {
	test('createThread uses fallback agent when no thread is active', async () => {
		const agents = [makeAgent({ id: 'a-1' }), makeAgent({ id: 'a-2' })];
		const createdThread = makeThread({ id: 'new-1', participantIds: ['a-2'], defaultAgentId: 'a-2' });
		const { model, transport } = buildModel({
			listAgents: vi.fn().mockResolvedValue(agents),
			createThread: vi.fn().mockResolvedValue(createdThread),
			getThread: vi.fn().mockResolvedValue(createdThread),
			getMessages: vi.fn().mockResolvedValue([]),
		});

		await model.loadInitial();
		model.selectAgent('a-2');
		flushSync();

		await model.createThread('Multi-agent thread');
		flushSync();

		expect(transport.createThread).toHaveBeenCalledWith({
			title: 'Multi-agent thread',
			participantIds: ['a-2'],
			defaultAgentId: 'a-2',
		});
	});

	test('addAgentToThread grows participant list', async () => {
		const agents = [makeAgent({ id: 'a-1' }), makeAgent({ id: 'a-2' }), makeAgent({ id: 'a-3' })];
		const thread = makeThread({ id: 'thread-1', participantIds: ['a-1'], defaultAgentId: 'a-1' });
		const afterAdd2 = makeThread({ id: 'thread-1', participantIds: ['a-1', 'a-2'], defaultAgentId: 'a-1' });
		const afterAdd3 = makeThread({ id: 'thread-1', participantIds: ['a-1', 'a-2', 'a-3'], defaultAgentId: 'a-1' });
		const addMock = vi.fn()
			.mockResolvedValueOnce(afterAdd2)
			.mockResolvedValueOnce(afterAdd3);
		const { model } = buildModel({
			listAgents: vi.fn().mockResolvedValue(agents),
			listThreads: vi.fn().mockResolvedValue([thread]),
			getThread: vi.fn().mockResolvedValue(thread),
			getMessages: vi.fn().mockResolvedValue([]),
			addThreadParticipant: addMock,
		});

		await model.loadInitial();
		await model.selectThread('thread-1');
		flushSync();
		expect(model.threadParticipants.length).toBe(1);

		await model.addAgentToThread('a-2');
		flushSync();
		expect(model.threadParticipants.length).toBe(2);

		await model.addAgentToThread('a-3');
		flushSync();
		expect(model.threadParticipants.length).toBe(3);
	});

	test('setDefaultAgent changes default and clears tool overrides', async () => {
		const agents = [makeAgent({ id: 'a-1' }), makeAgent({ id: 'a-2' })];
		const thread = makeThread({ id: 'thread-1', participantIds: ['a-1', 'a-2'], defaultAgentId: 'a-1' });
		const updatedThread = makeThread({ id: 'thread-1', participantIds: ['a-1', 'a-2'], defaultAgentId: 'a-2' });
		const { model, transport } = buildModel({
			listAgents: vi.fn().mockResolvedValue(agents),
			listThreads: vi.fn().mockResolvedValue([thread]),
			getThread: vi.fn().mockResolvedValue(thread),
			getMessages: vi.fn().mockResolvedValue([]),
			setThreadAgent: vi.fn().mockResolvedValue(updatedThread),
		});

		await model.loadInitial();
		await model.selectThread('thread-1');
		model.toggleTool('web_search', false);
		flushSync();

		await model.setDefaultAgent('a-2');
		flushSync();

		expect(transport.setThreadAgent).toHaveBeenCalledWith('thread-1', 'a-2');
		expect(model.selectedAgentId).toBe('a-2');
	});
});

describe('createChatPageModel – hosted tool state', () => {
	test('hostedTools is empty when no agent is selected', async () => {
		const { model } = buildModel({
			listAgents: vi.fn().mockResolvedValue([]),
		});

		await model.loadInitial();
		flushSync();

		expect(model.hostedTools).toEqual([]);
	});

	test('hostedTools include GPT-4.1 default-enabled tools when tool state is empty', async () => {
		const agent = makeAgent({
			id: 'a-1',
			modelCard: {
				...Gpt41ModelCard,
				nativeTools: ['web_search', 'image_generation', 'code_interpreter'],
			},
			toolState: {},
		});
		const { model } = buildModel({
			listAgents: vi.fn().mockResolvedValue([agent]),
		});

		await model.loadInitial();
		flushSync();

		expect(model.hostedTools).toEqual([
			expect.objectContaining({ name: 'web_search', enabled: true }),
			expect.objectContaining({ name: 'image_generation', enabled: true }),
			expect.objectContaining({ name: 'code_interpreter', enabled: false }),
		]);
	});

	test('hostedTools resolves tools from default agent model card', async () => {
		const agent = makeAgent({
			id: 'a-1',
			modelCard: {
				...Gpt41ModelCard,
				nativeTools: ['web_search', 'code_interpreter'],
			},
			toolState: { web_search: true, code_interpreter: true },
		});
		const { model } = buildModel({
			listAgents: vi.fn().mockResolvedValue([agent]),
		});

		await model.loadInitial();
		flushSync();

		expect(model.hostedTools.length).toBe(2);
		expect(model.hostedTools[0].name).toBe('web_search');
		expect(model.hostedTools[0].enabled).toBe(true);
		expect(model.hostedTools[1].name).toBe('code_interpreter');
	});

	test('toggleTool overrides tool enabled state', async () => {
		const agent = makeAgent({
			id: 'a-1',
			modelCard: {
				...Gpt41ModelCard,
				nativeTools: ['web_search'],
			},
			toolState: { web_search: true },
		});
		const { model } = buildModel({
			listAgents: vi.fn().mockResolvedValue([agent]),
		});

		await model.loadInitial();
		flushSync();

		expect(model.hostedTools[0].enabled).toBe(true);

		model.toggleTool('web_search', false);
		flushSync();

		expect(model.hostedTools[0].enabled).toBe(false);
	});

	test('toggleTool override is cleared on thread switch', async () => {
		const agent = makeAgent({
			id: 'a-1',
			modelCard: {
				...Gpt41ModelCard,
				nativeTools: ['web_search'],
			},
			toolState: { web_search: true },
		});
		const thread1 = makeThread({ id: 'thread-1', participantIds: ['a-1'], defaultAgentId: 'a-1' });
		const thread2 = makeThread({ id: 'thread-2', participantIds: ['a-1'], defaultAgentId: 'a-1' });
		const { model } = buildModel({
			listAgents: vi.fn().mockResolvedValue([agent]),
			listThreads: vi.fn().mockResolvedValue([thread1, thread2]),
			getThread: vi.fn().mockImplementation(async (id) => id === 'thread-1' ? thread1 : thread2),
			getMessages: vi.fn().mockResolvedValue([]),
		});

		await model.loadInitial();
		await model.selectThread('thread-1');
		model.toggleTool('web_search', false);
		flushSync();
		expect(model.hostedTools[0].enabled).toBe(false);

		await model.selectThread('thread-2');
		flushSync();
		expect(model.hostedTools[0].enabled).toBe(true);
	});

	test('hiddenToolToggles are filtered from hostedTools', async () => {
		const agent = makeAgent({
			id: 'a-1',
			modelCard: {
				...Gpt41ModelCard,
				nativeTools: ['web_search', 'code_interpreter'],
				uiPresentation: {
					...Gpt41ModelCard.uiPresentation,
					hiddenToolToggles: ['code_interpreter'],
				},
			},
			toolState: { web_search: true, code_interpreter: true },
		});
		const { model } = buildModel({
			listAgents: vi.fn().mockResolvedValue([agent]),
		});

		await model.loadInitial();
		flushSync();

		expect(model.hostedTools.length).toBe(1);
		expect(model.hostedTools[0].name).toBe('web_search');
	});
});
