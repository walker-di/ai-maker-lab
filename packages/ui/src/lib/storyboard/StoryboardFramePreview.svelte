<script lang="ts">
	import type { StoryboardFrame } from './types.js';
	interface Props { frame: StoryboardFrame; }
	let { frame }: Props = $props();
</script>

<div class="rounded-lg border bg-muted/30 p-3">
	{#if frame.mainImageUrl}
		<img src={frame.mainImageUrl} alt={frame.title ?? 'Storyboard frame'} class="aspect-square w-full rounded-md object-cover" />
	{:else}
		<div class="flex aspect-square items-center justify-center rounded-md bg-muted text-sm text-muted-foreground">No preview</div>
	{/if}
</div>
