import type { ModelCard, ResolvedAgentProfile } from 'domain/shared';
import type {
	AgentRegistrySourceFilter,
	AgentRegistryStatusFilter,
	AgentRegistryToolOption,
} from 'ui/source';
import type {
	ChatTransport,
	SaveUserAgentInput,
	UpdateUserAgentInput,
} from '$lib/adapters/chat/ChatTransport';

type CreateAgentRegistryPageModelInput = {
	transport: ChatTransport;
	modelCatalog: readonly ModelCard[];
};

type AgentDraft = {
	name: string;
	description: string;
	systemPrompt: string;
	modelCardId: string;
	toolState: Record<string, boolean>;
};

function getAgentStatus(agent: ResolvedAgentProfile): Exclude<AgentRegistryStatusFilter, 'all'> {
	if (agent.source === 'system') {
		return 'system';
	}

	if (agent.isInherited) {
		return 'inherited';
	}

	if (agent.isDuplicatedFromSystem) {
		return 'duplicated';
	}

	return 'custom';
}

function buildDraft(agent: ResolvedAgentProfile | null, modelCatalog: readonly ModelCard[]): AgentDraft {
	if (!agent) {
		const fallbackModel = modelCatalog[0];
		return {
			name: '',
			description: '',
			systemPrompt: '',
			modelCardId: fallbackModel?.registryId ?? '',
			toolState: {},
		};
	}

	return {
		name: agent.name,
		description: agent.description,
		systemPrompt: agent.systemPrompt,
		modelCardId: agent.modelCard.registryId,
		toolState: { ...(agent.toolState ?? {}) },
	};
}

function formatProvider(provider: string | undefined): string {
	return provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : 'Unknown';
}

function isToolEnabledByDefault(toolKey: string, modelCard: ModelCard | undefined): boolean {
	return modelCard?.toolPolicy.defaultEnabledTools.includes(toolKey as never) ?? false;
}

function isToolRemovable(toolKey: string, modelCard: ModelCard | undefined): boolean {
	return modelCard?.toolPolicy.removableTools.includes(toolKey as never) ?? false;
}

function resolveDraftToolEnabled(
	toolKey: string,
	draft: AgentDraft,
	modelCard: ModelCard | undefined,
): boolean {
	const explicitState = draft.toolState[toolKey];
	if (explicitState === true) {
		return true;
	}

	if (explicitState === false && isToolRemovable(toolKey, modelCard)) {
		return false;
	}

	return isToolEnabledByDefault(toolKey, modelCard);
}

function toToolOptions(draft: AgentDraft, modelCard: ModelCard | undefined): AgentRegistryToolOption[] {
	const hidden = new Set<string>(modelCard?.uiPresentation?.hiddenToolToggles ?? []);
	const keys = new Set<string>([
		...Object.keys(draft.toolState),
		...(modelCard?.nativeTools ?? []),
	]);

	return [...keys]
		.filter((key) => !hidden.has(key))
		.sort((left, right) => left.localeCompare(right))
		.map((key) => ({
			key,
			label: key
				.replace(/[_-]+/g, ' ')
				.split(' ')
				.filter(Boolean)
				.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
				.join(' '),
			enabled: resolveDraftToolEnabled(key, draft, modelCard),
		}));
}

function toCreateInput(draft: AgentDraft): SaveUserAgentInput {
	return {
		name: draft.name.trim(),
		description: draft.description.trim(),
		modelCardId: draft.modelCardId,
		systemPrompt: draft.systemPrompt.trim(),
		toolOverrides: { ...draft.toolState },
	};
}

function toUpdateInput(draft: AgentDraft): UpdateUserAgentInput {
	return {
		modelCardId: draft.modelCardId,
		systemPrompt: draft.systemPrompt.trim(),
		toolOverrides: { ...draft.toolState },
		userOverrides: {
			name: draft.name.trim(),
			description: draft.description.trim(),
		},
	};
}

export function createAgentRegistryPageModel({
	transport,
	modelCatalog,
}: CreateAgentRegistryPageModelInput) {
	let agents: ResolvedAgentProfile[] = [];
	let selectedAgentId: string | null = null;
	let searchQuery = '';
	let sourceFilter: AgentRegistrySourceFilter = 'all';
	let statusFilter: AgentRegistryStatusFilter = 'all';
	let providerFilter = 'all';
	let mode: 'browse' | 'create' = 'browse';
	let draft: AgentDraft = buildDraft(null, modelCatalog);
	let isLoading = false;
	let isSaving = false;
	let hasLoaded = false;
	let errorMessage: string | null = null;

	function getSelectedAgent() {
		return agents.find((agent) => agent.id === selectedAgentId) ?? null;
	}

	function getSelectedModelCard() {
		return modelCatalog.find((card) => card.registryId === draft.modelCardId) ?? modelCatalog[0];
	}

	function getProviders() {
		return [...new Set(agents.map((agent) => agent.modelCard.provider).filter(Boolean) as string[])]
			.sort((left, right) => left.localeCompare(right))
			.map(formatProvider);
	}

	function getFilteredAgents() {
		return agents.filter((agent) => {
			const query = searchQuery.trim().toLowerCase();
			const matchesSearch =
				query.length === 0 ||
				agent.name.toLowerCase().includes(query) ||
				agent.description.toLowerCase().includes(query);
			const matchesSource = sourceFilter === 'all' || agent.source === sourceFilter;
			const matchesStatus = statusFilter === 'all' || getAgentStatus(agent) === statusFilter;
			const formattedProvider = formatProvider(agent.modelCard.provider);
			const matchesProvider = providerFilter === 'all' || formattedProvider === providerFilter;

			return matchesSearch && matchesSource && matchesStatus && matchesProvider;
		});
	}

	function getToolOptions() {
		return toToolOptions(draft, getSelectedModelCard());
	}

	function getModelOptions() {
		return modelCatalog.map((card) => ({
			registryId: card.registryId,
			label: card.label,
			provider: formatProvider(card.provider),
			description: card.description,
		}));
	}

	function getIsEditing() {
		return mode === 'create' || getSelectedAgent()?.isEditable === true;
	}

	function getCanSave() {
		return (
			getIsEditing() &&
			!isSaving &&
			draft.name.trim().length > 0 &&
			draft.systemPrompt.trim().length > 0 &&
			draft.modelCardId.length > 0
		);
	}

	function getUseInChatHref() {
		const selectedAgent = getSelectedAgent();
		return mode === 'browse' && selectedAgent
			? `/experiments/chat?agent=${encodeURIComponent(selectedAgent.id)}`
			: undefined;
	}

	function getHasActiveFilters() {
		return (
			searchQuery.trim().length > 0 ||
			sourceFilter !== 'all' ||
			statusFilter !== 'all' ||
			providerFilter !== 'all'
		);
	}

	function setDraftFromAgent(agent: ResolvedAgentProfile | null) {
		draft = buildDraft(agent, modelCatalog);
	}

	function reconcileSelection(preferredId: string | null = selectedAgentId) {
		if (mode === 'create') {
			return;
		}

		const filteredAgents = getFilteredAgents();
		const visibleIds = new Set(filteredAgents.map((agent) => agent.id));
		if (preferredId && visibleIds.has(preferredId)) {
			selectedAgentId = preferredId;
			const preferred = agents.find((agent) => agent.id === preferredId) ?? null;
			setDraftFromAgent(preferred);
			return;
		}

		const next = filteredAgents[0] ?? null;
		selectedAgentId = next?.id ?? null;
		setDraftFromAgent(next);
	}

	async function refreshAgents(preferredId?: string | null) {
		const fresh = await apply(() => transport.listAgents());
		if (!fresh) {
			return false;
		}

		agents = fresh;
		reconcileSelection(preferredId ?? selectedAgentId);
		return true;
	}

	async function apply<T>(action: () => Promise<T>): Promise<T | undefined> {
		try {
			errorMessage = null;
			return await action();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'An error occurred.';
			console.error(error);
			return undefined;
		}
	}

	return {
		get agents() {
			return agents;
		},
		get selectedAgent() {
			return getSelectedAgent();
		},
		get selectedAgentId() {
			return selectedAgentId;
		},
		get filteredAgents() {
			return getFilteredAgents();
		},
		get draft() {
			return draft;
		},
		get providers() {
			return getProviders();
		},
		get sourceFilter() {
			return sourceFilter;
		},
		get statusFilter() {
			return statusFilter;
		},
		get providerFilter() {
			return providerFilter;
		},
		get searchQuery() {
			return searchQuery;
		},
		get modelOptions() {
			return getModelOptions();
		},
		get toolOptions() {
			return getToolOptions();
		},
		get activeModelCard() {
			return getSelectedModelCard();
		},
		get isLoading() {
			return isLoading;
		},
		get isSaving() {
			return isSaving;
		},
		get hasLoaded() {
			return hasLoaded;
		},
		get errorMessage() {
			return errorMessage;
		},
		get isCreating() {
			return mode === 'create';
		},
		get isEditing() {
			return getIsEditing();
		},
		get canSave() {
			return getCanSave();
		},
		get useInChatHref() {
			return getUseInChatHref();
		},
		get hasActiveFilters() {
			return getHasActiveFilters();
		},

		async loadInitial() {
			isLoading = true;
			errorMessage = null;

			try {
				const refreshed = await refreshAgents(selectedAgentId);
				if (refreshed) {
					hasLoaded = true;
				}
			} finally {
				isLoading = false;
			}
		},

		dismissError() {
			errorMessage = null;
		},

		setSearchQuery(value: string) {
			searchQuery = value;
			reconcileSelection();
		},

		setSourceFilter(value: AgentRegistrySourceFilter) {
			sourceFilter = value;
			reconcileSelection();
		},

		setStatusFilter(value: AgentRegistryStatusFilter) {
			statusFilter = value;
			reconcileSelection();
		},

		setProviderFilter(value: string) {
			providerFilter = value;
			reconcileSelection();
		},

		selectAgent(agentId: string) {
			mode = 'browse';
			selectedAgentId = agentId;
			setDraftFromAgent(agents.find((agent) => agent.id === agentId) ?? null);
		},

		startCreateAgent() {
			mode = 'create';
			selectedAgentId = null;
			draft = buildDraft(null, modelCatalog);
		},

		updateName(value: string) {
			draft = { ...draft, name: value };
		},

		updateDescription(value: string) {
			draft = { ...draft, description: value };
		},

		updateSystemPrompt(value: string) {
			draft = { ...draft, systemPrompt: value };
		},

		updateModelCard(modelCardId: string) {
			draft = {
				...draft,
				modelCardId,
			};
		},

		updateToolState(toolKey: string, enabled: boolean) {
			const modelCard = modelCatalog.find((card) => card.registryId === draft.modelCardId) ?? modelCatalog[0];
			const nextToolState = { ...draft.toolState };
			const defaultEnabled = isToolEnabledByDefault(toolKey, modelCard);

			if (enabled === defaultEnabled) {
				delete nextToolState[toolKey];
			} else {
				nextToolState[toolKey] = enabled;
			}

			draft = {
				...draft,
				toolState: nextToolState,
			};
		},

		async duplicateSelectedAgent() {
			const selectedAgent = getSelectedAgent();
			if (!selectedAgent || selectedAgent.source !== 'system') {
				return;
			}

			const duplicated = await apply(() => transport.duplicateSystemAgent(selectedAgent.id));
			if (duplicated) {
				mode = 'browse';
				await refreshAgents(duplicated.id);
			}
		},

		async inheritSelectedAgent() {
			const selectedAgent = getSelectedAgent();
			if (!selectedAgent || selectedAgent.source !== 'system') {
				return;
			}

			const inherited = await apply(() => transport.inheritSystemAgent(selectedAgent.id));
			if (inherited) {
				mode = 'browse';
				await refreshAgents(inherited.id);
			}
		},

		async saveAgent() {
			if (!getCanSave()) {
				return;
			}

			isSaving = true;
			try {
				if (mode === 'create') {
					const created = await apply(() => transport.saveUserAgent(toCreateInput(draft)));
					if (created) {
						mode = 'browse';
						await refreshAgents(created.id);
					}
					return;
				}

				const selectedAgent = getSelectedAgent();
				if (!selectedAgent) {
					return;
				}

				const updated = await apply(() =>
					transport.updateUserAgent(selectedAgent.id, toUpdateInput(draft)),
				);
				if (updated) {
					await refreshAgents(updated.id);
				}
			} finally {
				isSaving = false;
			}
		},
	};
}
