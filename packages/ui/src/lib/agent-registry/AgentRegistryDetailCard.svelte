<script lang="ts">
	import { Input } from '$ui/components/ui/input/index.js';
	import { Label } from '$ui/components/ui/label/index.js';
	import { Textarea } from '$ui/components/ui/textarea/index.js';
	import { Switch } from '$ui/components/ui/switch/index.js';
	import ChatModelBadge from '../chat/ChatModelBadge.svelte';
	import AgentRegistrySourceBadge from './AgentRegistrySourceBadge.svelte';
	import AgentRegistryInheritanceBadge from './AgentRegistryInheritanceBadge.svelte';
	import { getAgentRegistryStatus } from './helpers.js';
	import type {
		AgentRegistryAgent,
		AgentRegistryEditorDraft,
		AgentRegistryModelOption,
		AgentRegistryToolOption,
	} from './types.js';

	interface Props {
		agent: AgentRegistryAgent | null;
		draft: AgentRegistryEditorDraft;
		activeModelCard?: AgentRegistryAgent['modelCard'] | null;
		isCreating?: boolean;
		isEditable?: boolean;
		modelOptions: readonly AgentRegistryModelOption[];
		toolOptions: readonly AgentRegistryToolOption[];
		onNameChange: (value: string) => void;
		onDescriptionChange: (value: string) => void;
		onSystemPromptChange: (value: string) => void;
		onModelCardChange: (value: string) => void;
		onToolToggle: (toolKey: string, enabled: boolean) => void;
	}

	let {
		agent,
		draft,
		activeModelCard = null,
		isCreating = false,
		isEditable = false,
		modelOptions,
		toolOptions,
		onNameChange,
		onDescriptionChange,
		onSystemPromptChange,
		onModelCardChange,
		onToolToggle,
	}: Props = $props();

	const status = $derived(agent ? getAgentRegistryStatus(agent) : 'custom');
	const displayModelCard = $derived(activeModelCard ?? agent?.modelCard ?? null);
</script>

<div class="space-y-6 rounded-2xl border p-5">
	<div class="space-y-3">
		<div class="flex flex-wrap items-center gap-2">
			{#if agent}
				<AgentRegistrySourceBadge source={agent.source} />
				<AgentRegistryInheritanceBadge {status} />
			{:else}
				<AgentRegistryInheritanceBadge status="custom" />
			{/if}

			{#if !isEditable}
				<span class="text-muted-foreground text-xs">Read-only system definition</span>
			{:else if isCreating}
				<span class="text-muted-foreground text-xs">New custom user agent</span>
			{:else}
				<span class="text-muted-foreground text-xs">Editable user-owned configuration</span>
			{/if}
		</div>

		<div>
			<h2 class="text-xl font-semibold">{isCreating ? 'Create Agent' : agent?.name ?? 'Agent Details'}</h2>
			<p class="text-muted-foreground mt-1 text-sm leading-6">
				{#if isCreating}
					Create a standalone agent with its own model, prompt, and tool configuration.
				{:else}
					{agent?.description ?? 'Select an agent to inspect its model and configuration.'}
				{/if}
			</p>
		</div>
	</div>

	{#if agent || displayModelCard}
		<div class="grid gap-4 md:grid-cols-2">
			<div class="rounded-xl border p-4">
				<p class="text-muted-foreground text-xs font-medium uppercase tracking-wide">Model</p>
				<p class="mt-2 text-sm font-medium">{displayModelCard?.label ?? 'Unknown model'}</p>
				{#if displayModelCard?.provider}
					<p class="text-muted-foreground mt-1 text-xs capitalize">{displayModelCard.provider}</p>
				{/if}
				{#if displayModelCard}
					<div class="mt-3">
						<ChatModelBadge presentation={displayModelCard.uiPresentation} />
					</div>
				{/if}
			</div>

			<div class="rounded-xl border p-4">
				<p class="text-muted-foreground text-xs font-medium uppercase tracking-wide">Lineage</p>
				<div class="mt-2 space-y-1 text-sm">
					{#if agent?.systemAgentId}
						<p>System ID: <span class="font-mono text-xs">{agent.systemAgentId}</span></p>
					{/if}
					{#if agent?.inheritsFromSystemAgentId}
						<p>Inherited from: <span class="font-mono text-xs">{agent.inheritsFromSystemAgentId}</span></p>
					{/if}
					{#if agent?.isDuplicatedFromSystem}
						<p>Detached copy of a system agent.</p>
					{/if}
					{#if !agent}
						<p>New standalone user agent.</p>
					{:else if !agent.inheritsFromSystemAgentId && !agent.systemAgentId && !agent.isDuplicatedFromSystem}
						<p>Standalone user agent.</p>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<div class="grid gap-4">
		<div class="space-y-2">
			<Label for="registry-agent-name">Name</Label>
			<Input
				id="registry-agent-name"
				value={draft.name}
				readonly={!isEditable}
				oninput={(event) => onNameChange(event.currentTarget.value)}
			/>
		</div>

		<div class="space-y-2">
			<Label for="registry-agent-description">Description</Label>
			<Textarea
				id="registry-agent-description"
				rows={3}
				value={draft.description}
				readonly={!isEditable}
				oninput={(event) => onDescriptionChange(event.currentTarget.value)}
			/>
		</div>

		<div class="space-y-2">
			<Label for="registry-agent-model">Model</Label>
			<select
				id="registry-agent-model"
				class="border-input bg-background flex h-10 w-full rounded-md border px-3 py-2 text-sm"
				value={draft.modelCardId}
				disabled={!isEditable}
				onchange={(event) => onModelCardChange(event.currentTarget.value)}
			>
				{#each modelOptions as option (option.registryId)}
					<option value={option.registryId}>{option.label} ({option.provider})</option>
				{/each}
			</select>
		</div>

		<div class="space-y-2">
			<Label for="registry-agent-prompt">System Prompt</Label>
			<Textarea
				id="registry-agent-prompt"
				rows={10}
				value={draft.systemPrompt}
				readonly={!isEditable}
				oninput={(event) => onSystemPromptChange(event.currentTarget.value)}
			/>
		</div>
	</div>

	<div class="space-y-3 rounded-xl border p-4">
		<div>
			<p class="text-sm font-semibold">Tools</p>
			<p class="text-muted-foreground mt-1 text-xs">
				Hosted native tool availability is driven by the selected model card.
			</p>
		</div>

		{#if toolOptions.length === 0}
			<p class="text-muted-foreground text-sm">No tool toggles are available for the selected model.</p>
		{:else}
			<div class="grid gap-3 md:grid-cols-2">
				{#each toolOptions as tool (tool.key)}
					<div
						class="flex items-center justify-between rounded-lg border px-3 py-2.5 transition-colors {tool.enabled
							? 'border-foreground/15 bg-accent/50'
							: 'opacity-60'}"
						data-testid="tool-toggle-{tool.key}"
					>
						<div class="min-w-0 pr-3">
							<p class="text-sm font-medium">{tool.label}</p>
							<p class="text-muted-foreground text-xs font-mono">{tool.key}</p>
						</div>
						<div class="flex shrink-0 items-center gap-2">
							<span
								class="text-xs font-medium {tool.enabled
									? 'text-foreground'
									: 'text-muted-foreground'}"
							>
								{tool.enabled ? 'On' : 'Off'}
							</span>
							<Switch
								checked={tool.enabled}
								disabled={!isEditable}
								aria-label="{tool.label} toggle"
								onCheckedChange={(checked) => onToolToggle(tool.key, checked)}
							/>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	{#if displayModelCard?.uiPresentation.warnings.length}
		<div class="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
			<p class="text-sm font-semibold">Warnings</p>
			{#each displayModelCard.uiPresentation.warnings as warning (warning)}
				<p class="text-sm">{warning}</p>
			{/each}
		</div>
	{/if}

	{#if displayModelCard?.uiPresentation.fallbackHints.length}
		<div class="space-y-2 rounded-xl border p-4">
			<p class="text-sm font-semibold">Fallback Hints</p>
			<ul class="text-muted-foreground space-y-1 text-sm">
				{#each displayModelCard.uiPresentation.fallbackHints as hint (hint)}
					<li>{hint}</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
