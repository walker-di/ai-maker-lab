<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		Button,
		MarketingEmptyState,
		MarketingShell,
	} from 'ui/source';
	import LayoutTemplateIcon from '@lucide/svelte/icons/layout-template';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import EditIcon from '@lucide/svelte/icons/pencil';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import { m } from '$lib/paraglide/messages.js';
	import { createCanvasTemplatesPage } from './canvas-templates-page.composition.js';

	const page = createCanvasTemplatesPage();

	function navigate(path: string) {
		void goto(`/marketing${path}`);
	}
</script>

<svelte:head>
	<title>{m.marketing_canvas_templates_page_title()}</title>
</svelte:head>

<MarketingShell activePath="/canvas-templates" onNavigate={navigate}>
	<div class="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
		<header class="flex items-start justify-between gap-4">
			<div class="space-y-2">
				<p class="text-muted-foreground text-sm font-medium">{m.marketing_manager_title()}</p>
				<h1 class="text-foreground text-3xl font-semibold tracking-tight">{m.marketing_canvas_templates_heading()}</h1>
				<p class="text-muted-foreground max-w-2xl text-sm leading-6">
					{m.marketing_canvas_templates_intro()}
				</p>
			</div>
			<Button onclick={() => void goto('/marketing/canvas-templates/new')}>
				<PlusIcon class="mr-2 h-4 w-4" />
				Create New Template
			</Button>
		</header>

		{#if page.errorMessage}
			<p class="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
				{page.errorMessage}
			</p>
		{/if}

		{#if page.hasTemplates}
			<section class="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label={m.marketing_canvas_templates_heading()}>
				{#each page.templates as template (template.id)}
					<div class="group relative rounded-xl border bg-card p-5 shadow-sm transition hover:shadow-md">
						<h2 class="text-base font-semibold">{template.name}</h2>
						{#if template.description}
							<p class="text-muted-foreground mt-2 text-sm leading-6">{template.description}</p>
						{/if}
						{#if template.aspectRatio}
							<p class="text-muted-foreground mt-1 text-xs">{template.aspectRatio}</p>
						{/if}
						<div class="mt-3 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
							<Button type="button" variant="ghost" size="icon" class="h-7 w-7" onclick={() => void goto(`/marketing/canvas-templates/${template.id}`)} aria-label="Edit {template.name}">
								<EditIcon class="h-3.5 w-3.5" />
							</Button>
							<Button type="button" variant="ghost" size="icon" class="h-7 w-7" onclick={() => void page.duplicateTemplate(template.id)} aria-label="Duplicate {template.name}">
								<CopyIcon class="h-3.5 w-3.5" />
							</Button>
							<Button type="button" variant="ghost" size="icon" class="h-7 w-7 text-destructive hover:text-destructive" onclick={() => void page.deleteTemplate(template.id)} aria-label="Delete {template.name}">
								<TrashIcon class="h-3.5 w-3.5" />
							</Button>
						</div>
					</div>
				{/each}
			</section>
		{:else if !page.isLoading && page.hasLoaded}
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
