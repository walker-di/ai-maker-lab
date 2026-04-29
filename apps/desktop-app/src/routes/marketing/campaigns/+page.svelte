<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import {
		Button,
		MarketingEmptyState,
		MarketingShell,
		CampaignCard,
		CampaignForm,
		type Campaign,
		type Product,
		type CreateCampaignInput,
	} from 'ui/source';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import MegaphoneIcon from '@lucide/svelte/icons/megaphone';
	import { m } from '$lib/paraglide/messages.js';
	import { createMarketingTransport } from '$lib/adapters/marketing/create-marketing-transport.js';

	const transport = createMarketingTransport();

	let campaigns = $state<Campaign[]>([]);
	let products = $state<Product[]>([]);
	let isLoading = $state(false);
	let hasLoaded = $state(false);
	let errorMessage = $state<string | null>(null);
	let isFormOpen = $state(false);
	let selectedCampaign = $state<Campaign | undefined>();

	const hasCampaigns = $derived(campaigns.length > 0);

	async function refresh() {
		try {
			errorMessage = null;
			isLoading = true;
			const [c, p] = await Promise.all([
				transport.catalog.listCampaigns(),
				transport.catalog.listProducts(),
			]);
			campaigns = c;
			products = p;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to load campaigns.';
		} finally {
			isLoading = false;
			hasLoaded = true;
		}
	}

	async function saveCampaign(data: CreateCampaignInput) {
		try {
			errorMessage = null;
			isLoading = true;
			if (selectedCampaign) {
				await transport.catalog.updateCampaign(selectedCampaign.id, data);
			} else {
				await transport.catalog.createCampaign(data);
			}
			await refresh();
			isFormOpen = false;
			selectedCampaign = undefined;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to save campaign.';
		} finally {
			isLoading = false;
		}
	}

	async function deleteCampaign(id: string) {
		try {
			errorMessage = null;
			isLoading = true;
			await transport.catalog.deleteCampaign(id);
			await refresh();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to delete campaign.';
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
	<title>{m.marketing_campaigns_page_title()}</title>
</svelte:head>

<MarketingShell activePath="/campaigns" onNavigate={navigate}>
	<div class="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
		<header class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
			<div class="space-y-2">
				<p class="text-muted-foreground text-sm font-medium">{m.marketing_manager_title()}</p>
				<h1 class="text-foreground text-3xl font-semibold tracking-tight">{m.marketing_campaigns_heading()}</h1>
				<p class="text-muted-foreground max-w-2xl text-sm leading-6">
					{m.marketing_campaigns_intro()}
				</p>
			</div>
			<Button type="button" class="gap-2" onclick={() => { selectedCampaign = undefined; isFormOpen = true; }}>
				<PlusIcon class="h-4 w-4" />
				{m.marketing_campaign_new()}
			</Button>
		</header>

		{#if errorMessage}
			<p class="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
				{errorMessage}
			</p>
		{/if}

		{#if isFormOpen}
			<section class="rounded-xl border bg-card p-5 shadow-sm">
				<CampaignForm
					campaign={selectedCampaign}
					{products}
					{isLoading}
					onSubmit={(data) => void saveCampaign(data)}
					onCancel={() => { isFormOpen = false; selectedCampaign = undefined; }}
				/>
			</section>
		{/if}

		{#if hasCampaigns}
			<section class="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label={m.marketing_campaigns_heading()}>
				{#each campaigns as campaign (campaign.id)}
					<CampaignCard
						{campaign}
						onEdit={() => { selectedCampaign = campaign; isFormOpen = true; }}
						onDelete={() => void deleteCampaign(campaign.id)}
					/>
				{/each}
			</section>
		{:else if !isLoading && hasLoaded}
			<MarketingEmptyState
				title={m.marketing_campaigns_empty_title()}
				description={m.marketing_campaigns_empty_description()}
				actionLabel={m.marketing_campaign_create_action()}
				onAction={() => { isFormOpen = true; }}
			>
				{#snippet icon()}
					<MegaphoneIcon class="h-6 w-6" />
				{/snippet}
			</MarketingEmptyState>
		{:else}
			<p class="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">{m.marketing_campaigns_loading()}</p>
		{/if}
	</div>
</MarketingShell>
