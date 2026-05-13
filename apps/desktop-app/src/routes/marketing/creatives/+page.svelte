<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import {
		Button,
		MarketingEmptyState,
		MarketingShell,
		CreativeCard,
		type Creative,
	} from 'ui/source';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import PaletteIcon from '@lucide/svelte/icons/palette';
	import { m } from '$lib/paraglide/messages.js';
	import { createMarketingTransport } from '$lib/adapters/marketing/create-marketing-transport.js';

	const transport = createMarketingTransport();

	let creatives = $state<Creative[]>([]);
	let isLoading = $state(false);
	let hasLoaded = $state(false);
	let errorMessage = $state<string | null>(null);

	const hasCreatives = $derived(creatives.length > 0);

	async function refresh() {
		try {
			errorMessage = null;
			isLoading = true;
			creatives = await transport.catalog.listCreatives();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to load creatives.';
		} finally {
			isLoading = false;
			hasLoaded = true;
		}
	}

	async function deleteCreative(id: string) {
		try {
			errorMessage = null;
			isLoading = true;
			await transport.catalog.deleteCreative(id);
			await refresh();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to delete creative.';
		} finally {
			isLoading = false;
		}
	}

	function navigate(path: string) {
		void goto(`/marketing${path}`);
	}

	onMount(() => { void refresh(); });
</script>

<svelte:head>
	<title>{m.marketing_creatives_page_title()}</title>
</svelte:head>

<MarketingShell activePath="/creatives" onNavigate={navigate}>
	<div class="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
		<header class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
			<div class="space-y-2">
				<p class="text-muted-foreground text-sm font-medium">{m.marketing_manager_title()}</p>
				<h1 class="text-foreground text-3xl font-semibold tracking-tight">{m.marketing_creatives_heading()}</h1>
				<p class="text-muted-foreground max-w-2xl text-sm leading-6">
					{m.marketing_creatives_intro()}
				</p>
			</div>
			<Button type="button" class="gap-2" disabled>
				<PlusIcon class="h-4 w-4" />
				{m.marketing_creative_new()}
			</Button>
		</header>

		{#if errorMessage}
			<p class="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
				{errorMessage}
			</p>
		{/if}

		{#if hasCreatives}
			<section class="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label={m.marketing_creatives_heading()}>
				{#each creatives as creative (creative.id)}
					<CreativeCard
						{creative}
						onDelete={() => void deleteCreative(creative.id)}
					/>
				{/each}
			</section>
		{:else if !isLoading && hasLoaded}
			<MarketingEmptyState
				title={m.marketing_creatives_empty_title()}
				description={m.marketing_creatives_empty_description()}
				actionLabel={m.marketing_creative_create_action()}
			>
				{#snippet icon()}
					<PaletteIcon class="h-6 w-6" />
				{/snippet}
			</MarketingEmptyState>
		{:else}
			<p class="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">{m.marketing_creatives_loading()}</p>
		{/if}
	</div>
</MarketingShell>
