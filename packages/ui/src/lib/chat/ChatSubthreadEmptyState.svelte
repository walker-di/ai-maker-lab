<script lang="ts">
	interface Props {
		title?: string;
		description?: string;
	}

	let {
		title = 'No replies yet',
		description = 'Start a focused side conversation from this message.',
	}: Props = $props();
</script>

<div class="text-muted-foreground rounded-xl border border-dashed px-4 py-6 text-center">
	<p class="text-sm font-medium text-foreground">{title}</p>
	<p class="mt-1 text-sm">{description}</p>
</div>
