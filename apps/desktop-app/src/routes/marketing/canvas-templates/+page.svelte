<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import {
		Button,
		MarketingEmptyState,
		MarketingShell,
	} from 'ui/source';
	import LayoutTemplateIcon from '@lucide/svelte/icons/layout-template';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import { m } from '$lib/paraglide/messages.js';
	import { createMarketingTransport } from '$lib/adapters/marketing/create-marketing-transport.js';

	const transport = createMarketingTransport();

	interface CanvasTemplateItem {
		id: string;
		name: string;
		description?: string;
	}

	let templates = $state<CanvasTemplateItem[]>([]);
	let isLoading = $state(false);
	let hasLoaded = $state(false);
	let errorMessage = $state<string | null>(null);

	const hasTemplates = $derived(templates.length > 0);

	async function refresh() {
		try {
			errorMessage = null;
			isLoading = true;
			templates = await transport.catalog.listCanvasTemplates();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to load templates.';
		} finally {
			isLoading = false;
			hasLoaded = true;
		}
	}

	async function duplicateTemplate(id: string) {
		try {
			errorMessage = null;
			await transport.catalog.duplicateCanvasTemplate(id);
			await refresh();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to duplicate template.';
		}
	}

	async function deleteTemplate(id: string) {
		try {
			errorMessage = null;
			isLoading = true;
			await transport.catalog.deleteCanvasTemplate(id);
			await refresh();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to delete template.';
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
	<title>{m.marketing_canvas_templates_page_title()}</title>
</svelte:head>

<MarketingShell activePath="/canvas-templates" onNavigate={navigate}>
	<div class="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
		<header class="space-y-2">
			<p class="text-muted-foreground text-sm font-medium">{m.marketing_manager_title()}</p>
			<h1 class="text-foreground text-3xl font-semibold tracking-tight">{m.marketing_canvas_templates_heading()}</h1>
			<p class="text-muted-foreground max-w-2xl text-sm leading-6">
				{m.marketing_canvas_templates_intro()}
			</p>
		</header>

		{#if errorMessage}
			<p class="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
				{errorMessage}
			</p>
		{/if}

		{#if hasTemplates}
			<section class="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label={m.marketing_canvas_templates_heading()}>
				{#each templates as template (template.id)}
					<div class="group relative rounded-xl border bg-card p-5 shadow-sm transition hover:shadow-md">
						<h2 class="text-base font-semibold">{template.name}</h2>
						{#if template.description}
							<p class="text-muted-foreground mt-2 text-sm leading-6">{template.description}</p>
						{/if}
						<div class="mt-3 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
							<Button type="button" variant="ghost" size="icon" class="h-7 w-7" onclick={() => void duplicateTemplate(template.id)} aria-label="Duplicate {template.name}">
								<CopyIcon class="h-3.5 w-3.5" />
							</Button>
							<Button type="button" variant="ghost" size="icon" class="h-7 w-7 text-destructive hover:text-destructive" onclick={() => void deleteTemplate(template.id)} aria-label="Delete {template.name}">
								<TrashIcon class="h-3.5 w-3.5" />
							</Button>
						</div>
					</div>
				{/each}
			</section>
		{:else if !isLoading && hasLoaded}
			<MarketingEmptyState
				title={m.marketing_canvas_templates_empty_title()}
				description={m.marketing_canvas_templates_empty_description()}
			>
				{#snippet icon()}
					<LayoutTemplateIcon class="h-6 w-6" />
				{/snippet}
			</MarketingEmptyState>
		{:else}
			<p class="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">{m.marketing_canvas_templates_loading()}</p>
		{/if}
	</div>
</MarketingShell>
