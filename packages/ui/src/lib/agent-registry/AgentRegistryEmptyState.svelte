<script lang="ts">
	import { Button } from '$ui/components/ui/button/index.js';

	interface Props {
		title?: string;
		description: string;
		actionLabel?: string;
		onAction?: () => void;
	}

	let {
		title = 'No agents found',
		description,
		actionLabel,
		onAction,
	}: Props = $props();
</script>

<div class="flex h-full min-h-48 flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center">
	<h3 class="text-sm font-semibold">{title}</h3>
	<p class="text-muted-foreground mt-2 max-w-sm text-sm leading-6">{description}</p>

	{#if actionLabel && onAction}
		<Button type="button" class="mt-4" onclick={onAction}>
			{actionLabel}
		</Button>
	{/if}
</div>
