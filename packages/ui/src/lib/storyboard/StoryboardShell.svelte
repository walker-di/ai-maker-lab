<script lang="ts">
	interface Props { children?: import('svelte').Snippet; }
	let { children }: Props = $props();
</script>

<section class="container mx-auto max-w-7xl space-y-6 p-6">
	{@render children?.()}
</section>
