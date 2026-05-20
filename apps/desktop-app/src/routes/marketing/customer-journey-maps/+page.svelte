<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		Button,
		MarketingEmptyState,
		MarketingShell,
		CustomerJourneyMapBoard,
		CustomerJourneyMapCard,
		CustomerJourneyMapForm,
	} from 'ui/source';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import MapIcon from '@lucide/svelte/icons/map';
	import { m } from '$lib/paraglide/messages.js';
	import { createCustomerJourneyMapsPage } from './customer-journey-maps-page.composition.js';

	const model = createCustomerJourneyMapsPage();

	function navigate(path: string) {
		void goto(`/marketing${path}`);
	}
</script>

<svelte:head>
	<title>{m.marketing_customer_journey_maps_page_title()}</title>
</svelte:head>

<MarketingShell activePath="/customer-journey-maps" onNavigate={navigate}>
	<div class="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
		<header class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
			<div class="space-y-2">
				<p class="text-muted-foreground text-sm font-medium">{m.marketing_manager_title()}</p>
				<h1 class="text-foreground text-3xl font-semibold tracking-tight">{m.marketing_customer_journey_maps_heading()}</h1>
				<p class="text-muted-foreground max-w-2xl text-sm leading-6">
					{m.marketing_customer_journey_maps_intro()}
				</p>
			</div>
			<Button type="button" class="gap-2" onclick={() => model.openCreateForm()} disabled={model.products.length === 0}>
				<PlusIcon class="h-4 w-4" />
				{m.marketing_customer_journey_map_new()}
			</Button>
		</header>

		{#if model.errorMessage}
			<p class="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
				{model.errorMessage}
			</p>
		{/if}

		{#if model.products.length === 0 && model.hasLoaded}
			<p class="text-muted-foreground rounded-md border border-dashed px-4 py-3 text-sm">
				{m.marketing_customer_journey_maps_create_product_first()}
			</p>
		{/if}

		{#if model.isFormOpen}
			<section class="rounded-xl border bg-card p-5 shadow-sm">
				<div class="mb-4 space-y-1">
					<h2 class="text-lg font-semibold">{model.selectedJourneyMap ? m.marketing_customer_journey_map_edit_heading() : m.marketing_customer_journey_map_create_heading()}</h2>
					<p class="text-muted-foreground text-sm">{m.marketing_customer_journey_maps_link_note()}</p>
				</div>
				<CustomerJourneyMapForm
					journeyMap={model.selectedJourneyMap}
					products={model.products}
					isLoading={model.isLoading}
					onSubmit={(data) => void model.saveJourneyMap(data)}
					onCancel={() => model.closeForm()}
				/>
			</section>
		{/if}

		{#if model.hasJourneyMaps}
			<CustomerJourneyMapBoard journeyMap={model.journeyMaps[0]} />

			<section class="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label={m.marketing_customer_journey_maps_heading()}>
				{#each model.journeyMaps as journeyMap (journeyMap.id)}
					<CustomerJourneyMapCard
						{journeyMap}
						onEdit={() => model.openEditForm(journeyMap)}
						onDelete={() => void model.deleteJourneyMap(journeyMap.id)}
					/>
				{/each}
			</section>
		{:else if !model.isLoading && model.hasLoaded}
			<MarketingEmptyState
				title={m.marketing_customer_journey_maps_empty_title()}
				description={m.marketing_customer_journey_maps_empty_description_global()}
				actionLabel={m.marketing_customer_journey_map_create_action()}
				onAction={() => model.openCreateForm()}
			>
				{#snippet icon()}
					<MapIcon class="h-6 w-6" />
				{/snippet}
			</MarketingEmptyState>
		{:else}
			<p class="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">{m.marketing_customer_journey_maps_loading()}</p>
		{/if}
	</div>
</MarketingShell>
