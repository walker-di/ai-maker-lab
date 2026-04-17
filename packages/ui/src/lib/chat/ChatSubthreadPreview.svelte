<script lang="ts">
	import { cn } from '$ui/utils.js';
	import ChatSubthreadCountBadge from './ChatSubthreadCountBadge.svelte';

	interface Props {
		replyCount: number;
		latestReplyPreview?: string;
		participantNames?: readonly string[];
		active?: boolean;
		onOpen?: () => void;
	}

	let {
		replyCount,
		latestReplyPreview = '',
		participantNames = [],
		active = false,
		onOpen,
	}: Props = $props();

	const participantsLabel = $derived(
		participantNames.length > 0 ? participantNames.join(', ') : 'Open thread',
	);
</script>

<button
	type="button"
	class={cn(
		'hover:bg-muted/70 flex w-full items-start justify-between gap-3 rounded-xl border px-3 py-2 text-left transition-colors',
		active && 'border-primary/40 bg-primary/5',
	)}
	onclick={() => onOpen?.()}
>
	<div class="min-w-0 space-y-1">
		<p class="text-muted-foreground text-xs font-medium uppercase tracking-wide">Thread</p>
		<p class="text-sm font-medium">{participantsLabel}</p>
		{#if latestReplyPreview}
			<p class="text-muted-foreground line-clamp-2 text-sm">{latestReplyPreview}</p>
		{/if}
	</div>

	<ChatSubthreadCountBadge {replyCount} {active} />
</button>
