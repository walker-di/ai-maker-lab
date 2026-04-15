<script lang="ts">
	import Provider from '../../components/ui/tooltip/tooltip-provider.svelte';
	import ChatComposer from '../ChatComposer.svelte';
	import type { ChatAgentProfile } from '../types.js';

	interface Props {
		draft?: string;
		agents?: ChatAgentProfile[];
		selectedAgentName?: string;
		canSend?: boolean;
		isSending?: boolean;
		placeholder?: string;
		disabledControls?: string[];
	}

	const defaultAgents: ChatAgentProfile[] = [
		{
			id: 'agent-auto',
			name: 'Auto',
			description: 'Automatically selects the best agent',
			source: 'system',
			isInherited: false,
			isStandalone: false,
			isEditable: false,
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
			description: 'Specialized for code generation',
			source: 'system',
			isInherited: false,
			isStandalone: false,
			isEditable: false,
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
	];

	let {
		draft = $bindable(''),
		agents = defaultAgents,
		selectedAgentName = 'Auto',
		canSend = false,
		isSending = false,
		placeholder = 'Ask, search, or make anything...',
		disabledControls = [],
	}: Props = $props();
</script>

<div class="dark bg-background text-foreground p-6" data-testid="composer-fixture" style="width: 480px; font-family: system-ui, sans-serif;">
	<Provider>
		<ChatComposer
			bind:draft
			{agents}
			{selectedAgentName}
			{canSend}
			{isSending}
			{placeholder}
			{disabledControls}
			onSend={() => {}}
			onSelectAgent={() => {}}
		/>
	</Provider>
</div>
