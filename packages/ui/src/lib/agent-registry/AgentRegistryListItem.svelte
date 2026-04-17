<script lang="ts">
	import { cn } from '$ui/utils.js';
	import ChatModelBadge from '../chat/ChatModelBadge.svelte';
	import AgentRegistrySourceBadge from './AgentRegistrySourceBadge.svelte';
	import AgentRegistryInheritanceBadge from './AgentRegistryInheritanceBadge.svelte';
	import { getAgentRegistryStatus } from './helpers.js';
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
		'flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors',
		'hover:bg-accent/50',
		selected && 'bg-accent'
	)}
	{onclick}
>
	<div
		class={cn(
			'bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
			agent.source === 'system' ? 'bg-primary/10 text-primary' : 'bg-secondary'
		)}
	>
		{agent.name.charAt(0).toUpperCase()}
	</div>

	<div class="min-w-0 flex-1 space-y-2">
		<div class="space-y-1">
			<div class="flex flex-wrap items-center gap-2">
				<span class="truncate text-sm font-semibold">{agent.name}</span>
				<AgentRegistrySourceBadge source={agent.source} />
				<AgentRegistryInheritanceBadge {status} />
			</div>
			<p class="text-muted-foreground line-clamp-2 text-xs leading-5">{agent.description}</p>
		</div>

		<div class="flex flex-wrap items-center gap-2 text-xs">
			<span class="font-medium">{agent.modelCard.label}</span>
			{#if agent.modelCard.provider}
				<span class="text-muted-foreground capitalize">{agent.modelCard.provider}</span>
			{/if}
		</div>

		<div class="min-w-0">
			<ChatModelBadge presentation={agent.modelCard.uiPresentation} />
		</div>
	</div>
</button>
