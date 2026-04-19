<script lang="ts">
	import ChatAgentListItem from '../ChatAgentListItem.svelte';
	import ChatAgentCard from '../ChatAgentCard.svelte';
	import type { ChatAgentProfile } from '../types.js';

	interface Props {
		showCard?: boolean;
	}

	let { showCard = false }: Props = $props();

	const agents: ChatAgentProfile[] = [
		{
			id: 'agent-auto',
			name: 'Auto',
			description: 'Automatically selects the best agent for your task based on context.',
			source: 'system',
			isInherited: false,
			isStandalone: false,
			isEditable: false,
			toolsEnabled: true,
			toolState: {},
			modelCard: {
				label: 'GPT-4o',
				registryId: 'openai:gpt-4o',
				uiPresentation: {
					badges: ['fast', 'vision'],
					warnings: [],
					disabledComposerControls: [],
					fallbackHints: [],
					hiddenToolToggles: [],
				},
			},
		},
		{
			id: 'agent-coder',
			name: 'Coder',
			description: 'Specialized for code generation and review with deep reasoning capabilities.',
			source: 'system',
			isInherited: false,
			isStandalone: false,
			isEditable: false,
			toolsEnabled: true,
			toolState: {},
			modelCard: {
				label: 'Claude 4 Sonnet',
				registryId: 'anthropic:claude-4-sonnet',
				uiPresentation: {
					badges: ['code', 'reasoning'],
					warnings: [],
					disabledComposerControls: [],
					fallbackHints: [],
					hiddenToolToggles: [],
				},
			},
		},
		{
			id: 'agent-custom',
			name: 'My Research Bot',
			description: 'Custom user-created agent for research tasks.',
			source: 'user',
			isInherited: true,
			isStandalone: false,
			isEditable: true,
			toolsEnabled: true,
			toolState: {},
			modelCard: {
				label: 'Gemini 3.0 Pro',
				registryId: 'google:gemini-3-pro',
				uiPresentation: {
					badges: ['search', 'long-context'],
					warnings: ['Experimental model — responses may vary.'],
					disabledComposerControls: [],
					fallbackHints: [],
					hiddenToolToggles: [],
				},
			},
		},
	];
</script>

<div class="dark bg-background text-foreground p-4" data-testid="agent-panel-fixture" style="width: 288px; font-family: system-ui, sans-serif;">
	<div class="space-y-1">
		{#each agents as agent, idx (agent.id)}
			<ChatAgentListItem
				{agent}
				selected={idx === 0}
			/>
		{/each}
	</div>

	{#if showCard}
		<div class="mt-4 border-t border-border pt-4">
			<ChatAgentCard
				agent={agents[0]}
				onUse={() => {}}
				onDuplicate={() => {}}
			/>
		</div>
	{/if}
</div>
