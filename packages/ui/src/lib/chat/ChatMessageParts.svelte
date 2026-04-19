<script lang="ts">
	import ChatMessageContent from './ChatMessageContent.svelte';
	import type { AssistantMessagePart } from './types.js';

	interface Props {
		parts: readonly AssistantMessagePart[];
	}

	let { parts }: Props = $props();
</script>

<div class="min-w-0 space-y-3">
	{#each parts as part, index (`${part.type}:${index}`)}
		{#if part.type === 'text'}
			<ChatMessageContent content={part.text} enableMarkdown={true} />
		{:else if part.type === 'image'}
			<div class="space-y-2">
				<a href={part.url} target="_blank" rel="noreferrer noopener" class="block">
					<img
						src={part.url}
						alt={part.alt ?? part.name ?? 'Generated image'}
						loading="lazy"
						class="max-h-[28rem] w-full rounded-xl border object-contain"
					/>
				</a>
				{#if part.name}
					<p class="text-muted-foreground text-xs">{part.name}</p>
				{/if}
			</div>
		{:else}
			<a
				href={part.url}
				target="_blank"
				rel="noreferrer noopener"
				class="bg-background/70 hover:bg-background flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors"
			>
				<span aria-hidden="true">📎</span>
				<span class="min-w-0 flex-1 truncate">{part.name}</span>
				<span class="text-muted-foreground text-xs">Open</span>
			</a>
		{/if}
	{/each}
</div>
