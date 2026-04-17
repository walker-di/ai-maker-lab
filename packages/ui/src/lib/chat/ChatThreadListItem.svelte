<script lang="ts">
	import type { ChatThread } from './types.js';
	import { cn } from '$ui/utils.js';

	interface Props {
		thread: ChatThread;
		active?: boolean;
		onclick?: () => void;
		ontitleedit?: () => void;
		ondelete?: () => void;
	}

	let { thread, active = false, onclick, ontitleedit, ondelete }: Props = $props();
</script>

<div
	class={cn(
		'group flex w-full items-center gap-1 rounded-lg px-3 py-2.5 text-left transition-colors',
		'hover:bg-accent/50 cursor-pointer',
		active && 'bg-accent text-accent-foreground'
	)}
	role="button"
	tabindex="0"
	onclick={onclick}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') onclick?.();
	}}
>
	<div class="min-w-0 flex-1">
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<span
			class="text-sm font-medium leading-tight truncate block"
			ondblclick={(event) => {
				event.stopPropagation();
				ontitleedit?.();
			}}
		>
			{thread.title}
		</span>
		<span class="text-muted-foreground text-xs">
			{new Date(thread.updatedAt).toLocaleDateString()}
		</span>
	</div>
	{#if ondelete && active}
		<button
			class="text-muted-foreground hover:text-destructive shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
			onclick={(e) => {
				e.stopPropagation();
				ondelete?.();
			}}
			aria-label="Delete thread"
		>
			<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M3 6h18" />
				<path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
				<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
			</svg>
		</button>
	{/if}
</div>
