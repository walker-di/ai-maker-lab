<script lang="ts">
	import { Button } from '$ui/components/ui/button/index.js';
	import InboxIcon from '@lucide/svelte/icons/inbox';

	interface Props {
		title: string;
		description: string;
		actionLabel?: string;
		onAction?: () => void;
		icon?: import('svelte').Snippet;
	}

	let { title, description, actionLabel, onAction, icon }: Props = $props();
</script>

<div
	class="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center"
>
	<div class="text-muted-foreground mb-4">
		{#if icon}
			{@render icon()}
		{:else}
			<InboxIcon class="h-10 w-10" aria-hidden="true" />
		{/if}
	</div>
	<h3 class="text-base font-semibold">{title}</h3>
	<p class="text-muted-foreground mt-2 max-w-sm text-sm leading-6">{description}</p>
	{#if actionLabel && onAction}
		<Button type="button" class="mt-6" onclick={onAction}>
			{actionLabel}
		</Button>
	{/if}
</div>
