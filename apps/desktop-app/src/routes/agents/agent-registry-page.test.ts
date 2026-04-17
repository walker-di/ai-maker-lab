import { describe, test, expect, vi } from 'vitest';
import { flushSync } from 'svelte';
import type { ChatTransport } from '$lib/adapters/chat/ChatTransport';
import type { ChatMessage, ChatThread, ResolvedAgentProfile } from 'domain/shared';
import {
	Claude4SonnetModelCard,
	Gpt41ModelCard,
	MODEL_CARD_CATALOG,
} from 'domain/shared';
import { createAgentRegistryPageModel } from './agent-registry-page.svelte.ts';

function makeAgent(overrides: Partial<ResolvedAgentProfile> = {}): ResolvedAgentProfile {
	return {
		id: `agent-${crypto.randomUUID().slice(0, 8)}`,
		name: 'General Assistant',
		description: 'A helpful assistant.',
		source: 'system',
		systemAgentId: 'system-general',
		isInherited: false,
		isDuplicatedFromSystem: false,
		isStandalone: false,
		isEditable: false,
		modelCard: Gpt41ModelCard,
		systemPrompt: 'You are helpful.',
		toolsEnabled: true,
		toolState: {},
		metadata: {},
		...overrides,
	};
}

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
		getMessages: vi.fn<() => Promise<ChatMessage[]>>().mockResolvedValue([]),
		getSubthread: vi.fn(),
		getAttachmentPreviewUrl: vi.fn().mockReturnValue(null),
		fetchAttachmentText: vi.fn().mockResolvedValue(''),
		duplicateSystemAgent: vi.fn().mockResolvedValue(makeAgent()),
		inheritSystemAgent: vi.fn().mockResolvedValue(makeAgent()),
		saveUserAgent: vi.fn().mockResolvedValue(makeAgent()),
		updateUserAgent: vi.fn().mockResolvedValue(makeAgent()),
		...overrides,
	};
}

function buildModel(transportOverrides: Partial<ChatTransport> = {}) {
	const transport = createMockTransport(transportOverrides);
	const model = createAgentRegistryPageModel({
		transport,
		modelCatalog: MODEL_CARD_CATALOG,
	});
	return { model, transport };
}

describe('createAgentRegistryPageModel', () => {
	test('loads agents and selects the first visible agent', async () => {
		const agents = [
			makeAgent({ id: 'system-1' }),
			makeAgent({
				id: 'user-1',
				source: 'user',
				isEditable: true,
				isStandalone: true,
				systemAgentId: undefined,
			}),
		];
		const { model } = buildModel({
			listAgents: vi.fn().mockResolvedValue(agents),
		});

		await model.loadInitial();
		flushSync();

		expect(model.agents).toEqual(agents);
		expect(model.selectedAgentId).toBe('system-1');
		expect(model.draft.name).toBe('General Assistant');
	});

	test('search and filters narrow the resolved list', async () => {
		const agents = [
			makeAgent({ id: 'system-1', name: 'General Assistant', modelCard: Gpt41ModelCard }),
			makeAgent({
				id: 'user-dup',
				name: 'Research Copy',
				source: 'user',
				isEditable: true,
				isStandalone: true,
				isDuplicatedFromSystem: true,
				systemAgentId: undefined,
				modelCard: Claude4SonnetModelCard,
			}),
		];
		const { model } = buildModel({
			listAgents: vi.fn().mockResolvedValue(agents),
		});

		await model.loadInitial();
		model.setSearchQuery('research');
		model.setStatusFilter('duplicated');
		model.setProviderFilter('Anthropic');
		flushSync();

		expect(model.filteredAgents.map((agent) => agent.id)).toEqual(['user-dup']);
	});

	test('duplicateSelectedAgent refreshes the list and keeps the duplicate selected', async () => {
		const initial = [makeAgent({ id: 'system-1' })];
		const duplicated = makeAgent({
			id: 'user-dup',
			source: 'user',
			isEditable: true,
			isStandalone: true,
			isDuplicatedFromSystem: true,
			systemAgentId: undefined,
		});
		const listAgents = vi
			.fn<() => Promise<ResolvedAgentProfile[]>>()
			.mockResolvedValueOnce(initial)
			.mockResolvedValueOnce([initial[0], duplicated]);
		const { model, transport } = buildModel({
			listAgents,
			duplicateSystemAgent: vi.fn().mockResolvedValue(duplicated),
		});

		await model.loadInitial();
		await model.duplicateSelectedAgent();
		flushSync();

		expect(transport.duplicateSystemAgent).toHaveBeenCalledWith('system-1');
		expect(model.selectedAgentId).toBe('user-dup');
		expect(model.selectedAgent?.isDuplicatedFromSystem).toBe(true);
	});

	test('inheritSelectedAgent refreshes the list and keeps the inherited copy selected', async () => {
		const initial = [makeAgent({ id: 'system-1' })];
		const inherited = makeAgent({
			id: 'user-inherit',
			source: 'user',
			isEditable: true,
			isInherited: true,
			isStandalone: false,
			inheritsFromSystemAgentId: 'system-1',
			systemAgentId: undefined,
		});
		const listAgents = vi
			.fn<() => Promise<ResolvedAgentProfile[]>>()
			.mockResolvedValueOnce(initial)
			.mockResolvedValueOnce([initial[0], inherited]);
		const { model, transport } = buildModel({
			listAgents,
			inheritSystemAgent: vi.fn().mockResolvedValue(inherited),
		});

		await model.loadInitial();
		await model.inheritSelectedAgent();
		flushSync();

		expect(transport.inheritSystemAgent).toHaveBeenCalledWith('system-1');
		expect(model.selectedAgentId).toBe('user-inherit');
		expect(model.selectedAgent?.isInherited).toBe(true);
	});

	test('startCreateAgent and saveAgent create a custom user agent', async () => {
		const initial = [makeAgent({ id: 'system-1' })];
		const created = makeAgent({
			id: 'user-new',
			name: 'Research Lead',
			description: 'Custom agent',
			source: 'user',
			isEditable: true,
			isStandalone: true,
			systemAgentId: undefined,
		});
		const listAgents = vi
			.fn<() => Promise<ResolvedAgentProfile[]>>()
			.mockResolvedValueOnce(initial)
			.mockResolvedValueOnce([initial[0], created]);
		const { model, transport } = buildModel({
			listAgents,
			saveUserAgent: vi.fn().mockResolvedValue(created),
		});

		await model.loadInitial();
		model.startCreateAgent();
		model.updateName('Research Lead');
		model.updateDescription('Custom agent');
		model.updateSystemPrompt('You are a research lead.');
		await model.saveAgent();
		flushSync();

		expect(transport.saveUserAgent).toHaveBeenCalledWith(
			expect.objectContaining({
				name: 'Research Lead',
				description: 'Custom agent',
				systemPrompt: 'You are a research lead.',
			}),
		);
		expect(model.selectedAgentId).toBe('user-new');
		expect(model.isCreating).toBe(false);
	});

	test('editable user agents save through updateUserAgent', async () => {
		const editable = makeAgent({
			id: 'user-editable',
			source: 'user',
			isEditable: true,
			isStandalone: true,
			systemAgentId: undefined,
		});
		const updated = { ...editable, name: 'Updated Name', description: 'Updated description' };
		const listAgents = vi
			.fn<() => Promise<ResolvedAgentProfile[]>>()
			.mockResolvedValueOnce([editable])
			.mockResolvedValueOnce([updated]);
		const { model, transport } = buildModel({
			listAgents,
			updateUserAgent: vi.fn().mockResolvedValue(updated),
		});

		await model.loadInitial();
		model.updateName('Updated Name');
		model.updateDescription('Updated description');
		await model.saveAgent();
		flushSync();

		expect(transport.updateUserAgent).toHaveBeenCalledWith(
			'user-editable',
			expect.objectContaining({
				userOverrides: {
					name: 'Updated Name',
					description: 'Updated description',
				},
			}),
		);
	});

	test('useInChatHref points to the selected agent', async () => {
		const agents = [makeAgent({ id: 'system-1' })];
		const { model } = buildModel({
			listAgents: vi.fn().mockResolvedValue(agents),
		});

		await model.loadInitial();
		flushSync();

		expect(model.useInChatHref).toBe('/experiments/chat?agent=system-1');
	});

	test('system agent tool options reflect GPT-4.1 default hosted tools', async () => {
		const agents = [
			makeAgent({
				id: 'system-1',
				modelCard: {
					...Gpt41ModelCard,
					nativeTools: ['web_search', 'file_search'],
				},
				toolState: {},
			}),
		];
		const { model } = buildModel({
			listAgents: vi.fn().mockResolvedValue(agents),
		});

		await model.loadInitial();
		flushSync();

		expect(model.toolOptions).toEqual(expect.arrayContaining([
			expect.objectContaining({ key: 'file_search', enabled: false }),
			expect.objectContaining({ key: 'web_search', enabled: true }),
			expect.objectContaining({ key: 'image_generation', enabled: true }),
			expect.objectContaining({ key: 'code_interpreter', enabled: false }),
		]));
	});

	test('inherited agent tool options preserve merged runtime defaults', async () => {
		const inherited = makeAgent({
			id: 'user-inherited',
			source: 'user',
			isEditable: true,
			isInherited: true,
			isStandalone: false,
			inheritsFromSystemAgentId: 'system-1',
			systemAgentId: undefined,
			modelCard: {
				...Gpt41ModelCard,
				nativeTools: ['web_search', 'file_search'],
			},
			toolState: { web_search: true },
		});
		const { model } = buildModel({
			listAgents: vi.fn().mockResolvedValue([inherited]),
		});

		await model.loadInitial();
		flushSync();

		expect(model.toolOptions).toEqual(expect.arrayContaining([
			expect.objectContaining({ key: 'file_search', enabled: false }),
			expect.objectContaining({ key: 'web_search', enabled: true }),
			expect.objectContaining({ key: 'image_generation', enabled: true }),
			expect.objectContaining({ key: 'code_interpreter', enabled: false }),
		]));
	});
});
