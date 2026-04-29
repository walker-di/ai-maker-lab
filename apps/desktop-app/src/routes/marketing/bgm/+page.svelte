<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import {
		Button,
		MarketingEmptyState,
		MarketingShell,
	} from 'ui/source';
	import MusicIcon from '@lucide/svelte/icons/music';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import { m } from '$lib/paraglide/messages.js';
	import { createMarketingTransport } from '$lib/adapters/marketing/create-marketing-transport.js';

	const transport = createMarketingTransport();

	interface BgmItem {
		id: string;
		name: string;
		url?: string;
		durationMs?: number;
	}

	let tracks = $state<BgmItem[]>([]);
	let isLoading = $state(false);
	let hasLoaded = $state(false);
	let errorMessage = $state<string | null>(null);

	const hasTracks = $derived(tracks.length > 0);

	async function refresh() {
		try {
			errorMessage = null;
			isLoading = true;
			tracks = await transport.catalog.listBgm();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to load BGM tracks.';
		} finally {
			isLoading = false;
			hasLoaded = true;
		}
	}

	async function deleteTrack(id: string) {
		try {
			errorMessage = null;
			isLoading = true;
			await transport.catalog.deleteBgm(id);
			await refresh();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to delete track.';
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
	<title>{m.marketing_bgm_page_title()}</title>
</svelte:head>

<MarketingShell activePath="/bgm" onNavigate={navigate}>
	<div class="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
		<header class="space-y-2">
			<p class="text-muted-foreground text-sm font-medium">{m.marketing_manager_title()}</p>
			<h1 class="text-foreground text-3xl font-semibold tracking-tight">{m.marketing_bgm_heading()}</h1>
			<p class="text-muted-foreground max-w-2xl text-sm leading-6">
				{m.marketing_bgm_intro()}
			</p>
		</header>

		{#if errorMessage}
			<p class="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
				{errorMessage}
			</p>
		{/if}

		{#if hasTracks}
			<section class="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label={m.marketing_bgm_heading()}>
				{#each tracks as track (track.id)}
					<div class="group relative rounded-xl border bg-card p-5 shadow-sm transition hover:shadow-md">
						<div class="flex items-start justify-between gap-2">
							<div class="flex items-center gap-3">
								<MusicIcon class="h-5 w-5 text-muted-foreground" />
								<div>
									<h2 class="text-base font-semibold">{track.name}</h2>
									{#if track.durationMs}
										<p class="text-muted-foreground text-xs">{Math.round(track.durationMs / 1000)}s</p>
									{/if}
								</div>
							</div>
							<Button type="button" variant="ghost" size="icon" class="h-7 w-7 text-destructive opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive" onclick={() => void deleteTrack(track.id)} aria-label="Delete {track.name}">
								<TrashIcon class="h-3.5 w-3.5" />
							</Button>
						</div>
					</div>
				{/each}
			</section>
		{:else if !isLoading && hasLoaded}
			<MarketingEmptyState
				title={m.marketing_bgm_empty_title()}
				description={m.marketing_bgm_empty_description()}
			>
				{#snippet icon()}
					<MusicIcon class="h-6 w-6" />
				{/snippet}
			</MarketingEmptyState>
		{:else}
			<p class="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">{m.marketing_bgm_loading()}</p>
		{/if}
	</div>
</MarketingShell>
