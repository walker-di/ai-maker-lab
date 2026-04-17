<script lang="ts">
	import AgentRegistryActionBar from '../AgentRegistryActionBar.svelte';
	import AgentRegistryDetailCard from '../AgentRegistryDetailCard.svelte';
	import AgentRegistryFilters from '../AgentRegistryFilters.svelte';
	import AgentRegistryListItem from '../AgentRegistryListItem.svelte';
	import type {
		AgentRegistryAgent,
		AgentRegistryEditorDraft,
		AgentRegistryModelOption,
	} from '../types.js';

	const agent: AgentRegistryAgent = {
		id: 'user-dup',
		name: 'Research Copy',
		description: 'A duplicated research assistant with hosted tools enabled.',
		source: 'user',
		isInherited: false,
		isDuplicatedFromSystem: true,
		isStandalone: true,
		isEditable: true,
		systemPrompt: 'You are a research assistant.',
		modelCard: {
			familyId: 'claude4',
			provider: 'anthropic',
			registryId: 'anthropic:claude-sonnet-4-20250514',
			label: 'Claude Sonnet 4',
			description: 'Balanced reasoning model.',
			uiPresentation: {
				badges: ['balanced'],
				warnings: ['Some hosted tools may fall back depending on runtime support.'],
				disabledComposerControls: [],
				fallbackHints: ['Prefer web fetch when search results need full page context.'],
				hiddenToolToggles: [],
			},
			nativeTools: ['web_search', 'web_fetch'],
			nativeToolFamilies: ['search', 'retrieval'],
		},
		toolState: {
			web_search: true,
			web_fetch: false,
		},
	};

	const systemAgent: AgentRegistryAgent = {
		id: 'sys-research',
		name: 'Research Agent',
		description: 'A system-defined research assistant.',
		source: 'system',
		systemAgentId: 'sys-research',
		isInherited: false,
		isStandalone: false,
		isEditable: false,
		systemPrompt: 'You are a research assistant.',
		modelCard: agent.modelCard,
		toolState: { web_search: true, web_fetch: true },
	};

	const draft: AgentRegistryEditorDraft = {
		name: agent.name,
		description: agent.description,
		systemPrompt: agent.systemPrompt,
		modelCardId: agent.modelCard.registryId,
		toolState: { ...(agent.toolState ?? {}) },
	};

	const systemDraft: AgentRegistryEditorDraft = {
		name: systemAgent.name,
		description: systemAgent.description,
		systemPrompt: systemAgent.systemPrompt,
		modelCardId: systemAgent.modelCard.registryId,
		toolState: { ...(systemAgent.toolState ?? {}) },
	};

	const modelOptions: AgentRegistryModelOption[] = [
		{
			registryId: 'openai:gpt-4.1',
			label: 'GPT-4.1',
			provider: 'OpenAI',
		},
		{
			registryId: agent.modelCard.registryId,
			label: agent.modelCard.label,
			provider: 'Anthropic',
		},
	];
</script>

<div
	class="dark bg-background text-foreground grid gap-4 p-4"
	data-testid="agent-registry-fixture"
	style="width: 1080px; font-family: system-ui, sans-serif;"
>
	<AgentRegistryFilters
		searchValue="research"
		sourceFilter="user"
		statusFilter="duplicated"
		providerFilter="Anthropic"
		providers={['Anthropic', 'OpenAI']}
		onSearchChange={() => {}}
		onSourceChange={() => {}}
		onStatusChange={() => {}}
		onProviderChange={() => {}}
	/>

	<div class="grid gap-4 md:grid-cols-[320px_minmax(0,1fr)]">
		<AgentRegistryListItem agent={agent} selected />

		<div class="space-y-4">
			<AgentRegistryActionBar
				useInChatHref="/experiments/chat?agent=user-dup"
				canEdit
				canDuplicate
				canSave
				onDuplicate={() => {}}
				onSave={() => {}}
			/>

			<div data-testid="editable-agent-section">
				<AgentRegistryDetailCard
					{agent}
					{draft}
					isEditable
					modelOptions={modelOptions}
					toolOptions={[
						{ key: 'web_search', label: 'Web Search', enabled: true },
						{ key: 'web_fetch', label: 'Web Fetch', enabled: false },
					]}
					onNameChange={() => {}}
					onDescriptionChange={() => {}}
					onSystemPromptChange={() => {}}
					onModelCardChange={() => {}}
					onToolToggle={() => {}}
				/>
			</div>

			<div data-testid="readonly-agent-section">
				<AgentRegistryDetailCard
					agent={systemAgent}
					draft={systemDraft}
					isEditable={false}
					modelOptions={modelOptions}
					toolOptions={[
						{ key: 'web_search', label: 'Web Search', enabled: true },
						{ key: 'web_fetch', label: 'Web Fetch', enabled: true },
					]}
					onNameChange={() => {}}
					onDescriptionChange={() => {}}
					onSystemPromptChange={() => {}}
					onModelCardChange={() => {}}
					onToolToggle={() => {}}
				/>
			</div>
		</div>
	</div>
</div>
