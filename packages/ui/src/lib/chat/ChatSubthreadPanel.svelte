<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$ui/utils.js';
	import ChatSubthreadHeader from './ChatSubthreadHeader.svelte';

	interface Props {
		title?: string;
		replyCount?: number;
		parentLabel?: string;
		onClose?: () => void;
		class?: string;
		parent?: Snippet;
		content?: Snippet;
		footer?: Snippet;
	}

	let {
		title = 'Thread',
		replyCount = 0,
		parentLabel = 'Original message',
		onClose,
		class: className,
		parent,
		content,
		footer,
	}: Props = $props();
</script>

<aside class={cn('bg-background flex h-full w-full flex-col', className)}>
	<div class="border-border border-b p-4">
		<ChatSubthreadHeader {title} {replyCount} {onClose} />
	</div>

	<div class="flex-1 overflow-y-auto p-4">
		<section class="space-y-3">
			<p class="text-muted-foreground text-xs font-medium uppercase tracking-wide">{parentLabel}</p>
			{@render parent?.()}
		</section>

		<div class="mt-6">
			{@render content?.()}
		</div>
	</div>

	<div class="border-border border-t p-4">
		{@render footer?.()}
	</div>
</aside>
