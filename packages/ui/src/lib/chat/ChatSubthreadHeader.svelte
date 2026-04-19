<script lang="ts">
	import { Button } from '$ui/components/ui/button/index.js';
	import ChatSubthreadCountBadge from './ChatSubthreadCountBadge.svelte';

	interface Props {
		title?: string;
		replyCount?: number;
		onClose?: () => void;
	}

	let { title = 'Thread', replyCount = 0, onClose }: Props = $props();
</script>

<div class="flex items-start justify-between gap-3">
	<div class="min-w-0 space-y-2">
		<p class="text-sm font-semibold">{title}</p>
		{#if replyCount > 0}
			<ChatSubthreadCountBadge {replyCount} />
		{/if}
	</div>

	{#if onClose}
		<Button variant="ghost" size="sm" class="h-8 w-8 shrink-0 p-0" onclick={onClose}>
			<span aria-hidden="true">×</span>
			<span class="sr-only">Close thread</span>
		</Button>
	{/if}
</div>
