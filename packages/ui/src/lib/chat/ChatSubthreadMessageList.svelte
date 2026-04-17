<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title?: string;
		children?: Snippet;
	}

	let { title = 'Replies', children }: Props = $props();
</script>

<section class="space-y-3">
	<p class="text-muted-foreground text-xs font-medium uppercase tracking-wide">{title}</p>
	<div class="space-y-3">
		{@render children?.()}
	</div>
</section>
