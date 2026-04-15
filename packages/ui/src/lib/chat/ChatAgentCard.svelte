<script lang="ts">
	import type { ChatAgentProfile } from './types.js';
	import { Badge } from '$ui/components/ui/badge/index.js';
	import { Button } from '$ui/components/ui/button/index.js';
	import ChatModelBadge from './ChatModelBadge.svelte';

	interface Props {
		agent: ChatAgentProfile;
		onUse?: () => void;
		onDuplicate?: () => void;
	}

	let { agent, onUse, onDuplicate }: Props = $props();
</script>

<div class="space-y-3 rounded-lg border p-4">
	<div class="flex items-start justify-between gap-2">
		<div>
			<h3 class="text-sm font-semibold">{agent.name}</h3>
			<p class="text-muted-foreground mt-0.5 text-xs">{agent.description}</p>
		</div>
		<div class="flex shrink-0 gap-1">
			{#if agent.source === 'system'}
				<Badge variant="outline" class="text-[10px]">System</Badge>
			{:else if agent.isInherited}
				<Badge variant="outline" class="text-[10px]">Inherited</Badge>
			{:else if agent.isStandalone}
				<Badge variant="secondary" class="text-[10px]">Custom</Badge>
			{/if}
		</div>
	</div>

	<div class="space-y-1.5">
		<div class="flex items-center gap-2 text-xs">
			<span class="text-muted-foreground">Model:</span>
			<span class="font-medium">{agent.modelCard.label}</span>
		</div>
		<ChatModelBadge presentation={agent.modelCard.uiPresentation} />
	</div>

	{#if agent.modelCard.uiPresentation.warnings.length > 0}
		<div class="space-y-1">
			{#each agent.modelCard.uiPresentation.warnings as warning (warning)}
				<p class="text-xs text-amber-600">{warning}</p>
			{/each}
		</div>
	{/if}

	<div class="flex gap-2">
		{#if onUse}
			<Button variant="default" size="sm" onclick={onUse}>Use</Button>
		{/if}
		{#if !agent.isEditable && onDuplicate}
			<Button variant="outline" size="sm" onclick={onDuplicate}>Duplicate</Button>
		{/if}
	</div>
</div>
