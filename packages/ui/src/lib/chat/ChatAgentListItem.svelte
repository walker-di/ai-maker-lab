<script lang="ts">
	import type { ChatAgentProfile } from './types.js';
	import { Badge } from '$ui/components/ui/badge/index.js';
	import { cn } from '$ui/utils.js';
	import ChatModelBadge from './ChatModelBadge.svelte';

	interface Props {
		agent: ChatAgentProfile;
		selected?: boolean;
		onclick?: () => void;
	}

	let { agent, selected = false, onclick }: Props = $props();
</script>

<button
	class={cn(
		'flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
		'hover:bg-accent/50',
		selected && 'bg-accent'
	)}
	{onclick}
>
	<div
		class={cn(
			'bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
			agent.source === 'system' ? 'bg-primary/10 text-primary' : 'bg-secondary'
		)}
	>
		{agent.name.charAt(0).toUpperCase()}
	</div>

	<div class="min-w-0 flex-1">
		<div class="flex items-center gap-2">
			<span class="text-sm font-medium truncate">{agent.name}</span>
			{#if agent.source === 'system'}
				<Badge variant="outline" class="text-[10px]">System</Badge>
			{:else if agent.isInherited}
				<Badge variant="outline" class="text-[10px]">Inherited</Badge>
			{:else if agent.isDuplicatedFromSystem}
				<Badge variant="outline" class="text-[10px]">Duplicated</Badge>
			{/if}
		</div>
		<p class="text-muted-foreground mt-0.5 text-xs truncate">{agent.modelCard.label}</p>
		<div class="mt-1">
			<ChatModelBadge presentation={agent.modelCard.uiPresentation} />
		</div>
	</div>
</button>
