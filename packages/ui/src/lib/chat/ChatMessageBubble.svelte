<script lang="ts">
	import { cn } from '$ui/utils.js';
	import ChatAgentChip from './ChatAgentChip.svelte';
	import ChatAttachmentPill from './ChatAttachmentPill.svelte';
	import type { AttachmentRef, AgentSource } from './types.js';

	interface Props {
		role: 'user' | 'assistant' | 'system';
		content: string;
		agentName?: string;
		agentSource?: AgentSource;
		attachments?: readonly AttachmentRef[];
		isStreaming?: boolean;
		isFailed?: boolean;
	}

	let {
		role,
		content,
		agentName,
		agentSource,
		attachments = [],
		isStreaming = false,
		isFailed = false,
	}: Props = $props();
</script>

<div
	class={cn(
		'flex gap-3',
		role === 'user' ? 'justify-end' : 'justify-start'
	)}
>
	<div
		class={cn(
			'max-w-[80%] rounded-2xl px-4 py-2.5',
			role === 'user'
				? 'bg-primary text-primary-foreground'
				: 'bg-muted',
			isFailed && 'border-destructive/50 border'
		)}
	>
		{#if agentName && role === 'assistant'}
			<div class="mb-1">
				<ChatAgentChip name={agentName} source={agentSource} />
			</div>
		{/if}

		<div class="text-sm leading-relaxed whitespace-pre-wrap">
			{content}
			{#if isStreaming}
				<span class="ml-1 inline-block h-4 w-1 animate-pulse rounded-full bg-current"></span>
			{/if}
		</div>

		{#if isFailed}
			<p class="text-destructive mt-1 text-xs">Message failed to send.</p>
		{/if}

		{#if attachments.length > 0}
			<div class="mt-2 flex flex-wrap gap-1">
				{#each attachments as att (att.id)}
					<ChatAttachmentPill attachment={att} />
				{/each}
			</div>
		{/if}
	</div>
</div>
