<script lang="ts">
	import { cn } from '$ui/utils.js';
	import ChatAgentChip from './ChatAgentChip.svelte';
	import ChatAttachmentPill from './ChatAttachmentPill.svelte';
	import ChatMessageContent from './ChatMessageContent.svelte';
	import ChatMessageParts from './ChatMessageParts.svelte';
	import ChatToolInvocationPill from './ChatToolInvocationPill.svelte';
	import type { AssistantMessagePart, AttachmentRef, AgentSource, ToolInvocationInfo } from './types.js';

	interface Props {
		role: 'user' | 'assistant' | 'system';
		content?: string;
		agentName?: string;
		agentSource?: AgentSource;
		attachments?: readonly AttachmentRef[];
		assistantParts?: readonly AssistantMessagePart[];
		toolInvocations?: readonly ToolInvocationInfo[];
		isStreaming?: boolean;
		isFailed?: boolean;
		onAttachmentOpen?: (attachment: AttachmentRef) => void;
		onToolInvocationOpen?: (invocation: ToolInvocationInfo) => void;
	}

	let {
		role,
		content = '',
		agentName,
		agentSource,
		attachments = [],
		assistantParts = [],
		toolInvocations = [],
		isStreaming = false,
		isFailed = false,
		onAttachmentOpen,
		onToolInvocationOpen,
	}: Props = $props();

	const hasAssistantParts = $derived(role !== 'user' && assistantParts.length > 0);
</script>

<div
	class={cn(
		'flex min-w-0 gap-3',
		role === 'user' ? 'justify-end' : 'justify-start'
	)}
>
	<div
		class={cn(
			'min-w-0 max-w-[80%] overflow-hidden rounded-2xl px-4 py-2.5',
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

		{#if toolInvocations.length > 0}
			<div class="mb-3 flex flex-wrap gap-2">
				{#each toolInvocations as invocation (invocation.toolCallId)}
					<ChatToolInvocationPill
						{invocation}
						onclick={() => onToolInvocationOpen?.(invocation)}
					/>
				{/each}
			</div>
		{/if}

		<div class="min-w-0">
			{#if hasAssistantParts}
				<ChatMessageParts parts={assistantParts} />
			{:else}
				<ChatMessageContent content={content} enableMarkdown={role !== 'user'} />
			{/if}
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
					<ChatAttachmentPill attachment={att} onOpen={onAttachmentOpen} />
				{/each}
			</div>
		{/if}
	</div>
</div>
