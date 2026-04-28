<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';

	interface BreadcrumbItem {
		label: string;
		href?: string;
	}

	interface Props {
		items: BreadcrumbItem[];
	}

	let { items }: Props = $props();
</script>

<nav aria-label="Breadcrumb" class="flex items-center gap-1 text-sm">
	{#each items as item, i}
		{#if i > 0}
			<ChevronRightIcon class="text-muted-foreground h-3.5 w-3.5 shrink-0" aria-hidden="true" />
		{/if}
		{#if item.href && i < items.length - 1}
			<a
				href={item.href}
				class="text-muted-foreground hover:text-foreground transition-colors"
			>
				{item.label}
			</a>
		{:else}
			<span
				class={i === items.length - 1 ? 'text-foreground font-medium' : 'text-muted-foreground'}
				aria-current={i === items.length - 1 ? 'page' : undefined}
			>
				{item.label}
			</span>
		{/if}
	{/each}
</nav>
