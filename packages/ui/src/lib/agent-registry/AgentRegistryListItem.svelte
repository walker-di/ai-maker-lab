<script lang="ts">
	import { cn } from '$ui/utils.js';
	import { Badge } from '$ui/components/ui/badge/index.js';
	import ChatModelBadge from '../chat/ChatModelBadge.svelte';
	import AgentRegistrySourceBadge from './AgentRegistrySourceBadge.svelte';
	import AgentRegistryInheritanceBadge from './AgentRegistryInheritanceBadge.svelte';
	import { getAgentRegistryStatus, formatProviderShort } from './helpers.js';
	import type { AgentRegistryAgent } from './types.js';

	interface Props {
		agent: AgentRegistryAgent;
		selected?: boolean;
		onclick?: () => void;
	}

	let { agent, selected = false, onclick }: Props = $props();

	const status = $derived(getAgentRegistryStatus(agent));
</script>

<button
	type="button"
	role="option"
	aria-selected={selected}
	class={cn(
		'group flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-all',
		'hover:bg-accent/50 hover:border-accent-foreground/10',
		selected && 'bg-accent border-accent-foreground/15 shadow-sm'
	)}
	{onclick}
>
	<div
		class={cn(
			'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold transition-colors',
			agent.source === 'system'
				? 'bg-primary/10 text-primary'
				: 'bg-secondary text-secondary-foreground'
		)}
	>
		{agent.name.charAt(0).toUpperCase()}
	</div>

	<div class="min-w-0 flex-1 space-y-1.5">
		<div class="flex flex-wrap items-center gap-1.5">
			<span class="truncate text-sm font-semibold">{agent.name}</span>
			<AgentRegistrySourceBadge source={agent.source} />
			<AgentRegistryInheritanceBadge {status} />
		</div>

		<p class="text-muted-foreground line-clamp-1 text-xs leading-relaxed">{agent.description}</p>

		<div class="flex flex-wrap items-center gap-1.5">
			{#if agent.modelCard.provider}
				<Badge variant="outline" class="gap-1 px-1.5 py-0 text-[10px] font-medium uppercase tracking-wide">
					{formatProviderShort(agent.modelCard.provider)}
				</Badge>
			{/if}
			<span class="text-muted-foreground truncate text-[11px] font-medium">{agent.modelCard.label}</span>
			{#if agent.modelCard.familyId}
				<span class="text-muted-foreground/60 text-[10px] font-mono">{agent.modelCard.familyId}</span>
			{/if}
		</div>

		{#if agent.modelCard.uiPresentation.badges.length > 0}
			<div class="min-w-0">
				<ChatModelBadge presentation={agent.modelCard.uiPresentation} />
			</div>
		{/if}
	</div>
</button>
