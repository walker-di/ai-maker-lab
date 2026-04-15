<script lang="ts">
	import type { ChatAgentProfile } from './types.js';
	import * as InputGroup from '$ui/components/ui/input-group/index.js';
	import * as DropdownMenu from '$ui/components/ui/dropdown-menu/index.js';
	import * as Tooltip from '$ui/components/ui/tooltip/index.js';
	import { Separator } from '$ui/components/ui/separator/index.js';

	interface Props {
		draft: string;
		ondraftchange?: (value: string) => void;
		agents?: readonly ChatAgentProfile[];
		selectedAgentName?: string;
		disabledControls?: readonly string[];
		canSend?: boolean;
		isSending?: boolean;
		onSend?: () => void;
		onSelectAgent?: (agentId: string) => void;
		placeholder?: string;
	}

	let {
		draft = $bindable(''),
		ondraftchange,
		agents = [],
		selectedAgentName = 'Auto',
		disabledControls = [],
		canSend = false,
		isSending = false,
		onSend,
		onSelectAgent,
		placeholder = 'Send a message...',
	}: Props = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey && canSend) {
			e.preventDefault();
			onSend?.();
		}
	}

	function isControlDisabled(control: string): boolean {
		return disabledControls.includes(control);
	}
</script>

<InputGroup.Root>
	<InputGroup.Textarea
		{placeholder}
		bind:value={draft}
		onkeydown={handleKeydown}
		class="min-h-[60px] resize-none"
		disabled={isSending}
	/>
	<InputGroup.Addon align="block-end">
		{#if !isControlDisabled('file-attach')}
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<InputGroup.Button {...props} size="icon-xs" disabled={isSending}>
							<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
							</svg>
						</InputGroup.Button>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content>Attach file</Tooltip.Content>
			</Tooltip.Root>
		{/if}

		{#if agents.length > 0 && onSelectAgent}
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<InputGroup.Button {...props} variant="ghost" disabled={isSending}>
							{selectedAgentName}
						</InputGroup.Button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content side="top" align="start" class="max-h-64 overflow-y-auto">
					{#each agents as agent (agent.id)}
						<DropdownMenu.Item onclick={() => onSelectAgent?.(agent.id)}>
							<span>{agent.name}</span>
							<span class="text-muted-foreground ml-2 text-xs">{agent.modelCard.label}</span>
						</DropdownMenu.Item>
					{/each}
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		{/if}

		<span class="ms-auto"></span>
		<Separator orientation="vertical" class="!h-4" />

		<InputGroup.Button
			variant="default"
			class="rounded-full"
			size="icon-xs"
			disabled={!canSend}
			onclick={() => onSend?.()}
		>
			<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="m5 12 7-7 7 7" />
				<path d="M12 19V5" />
			</svg>
			<span class="sr-only">Send</span>
		</InputGroup.Button>
	</InputGroup.Addon>
</InputGroup.Root>
