<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		Button,
		MarketingShell,
		CanvasEditor,
		CanvasToolbar,
	} from 'ui/source';
	import { m } from '$lib/paraglide/messages.js';
	import { createMarketingTransport } from '$lib/adapters/marketing/create-marketing-transport.js';
	import { createNewTemplatePageModel } from './canvas-template-new-page.svelte.js';
	import { CanvasAspectRatio } from 'domain/shared';

	const page = createNewTemplatePageModel({ transport: createMarketingTransport() });
	let editorRef: ReturnType<typeof CanvasEditor> | undefined = $state();

	function navigate(path: string) {
		void goto(`/marketing${path}`);
	}

	async function handleSave() {
		const success = await page.save();
		if (success) {
			void goto('/marketing/canvas-templates');
		}
	}

	const aspectRatioOptions = Object.values(CanvasAspectRatio);
</script>

<svelte:head>
	<title>New Canvas Template</title>
</svelte:head>

<MarketingShell activePath="/canvas-templates" onNavigate={navigate}>
	<div class="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
		<header class="space-y-1">
			<h1 class="text-foreground text-2xl font-semibold tracking-tight">New Canvas Template</h1>
		</header>

		{#if page.errorMessage}
			<p class="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
				{page.errorMessage}
			</p>
		{/if}

		<form onsubmit={(e) => { e.preventDefault(); handleSave(); }} class="flex flex-col gap-6">
			<div class="grid gap-4 sm:grid-cols-2">
				<div class="flex flex-col gap-1.5">
					<label for="name" class="text-sm font-medium">Template Name</label>
					<input
						id="name"
						type="text"
						class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
						placeholder="e.g., Product Intro Blue"
						bind:value={page.name}
						required
					/>
				</div>
				<div class="flex flex-col gap-1.5">
					<label for="aspect-ratio" class="text-sm font-medium">Aspect Ratio</label>
					<select
						id="aspect-ratio"
						class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
						bind:value={page.aspectRatio}
					>
						{#each aspectRatioOptions as ratio}
							<option value={ratio}>{ratio}</option>
						{/each}
					</select>
				</div>
			</div>

			<div class="flex flex-col gap-1.5">
				<label for="description" class="text-sm font-medium">Description</label>
				<textarea
					id="description"
					class="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
					placeholder="Describe the purpose or style of this template"
					bind:value={page.description}
				></textarea>
			</div>

			<div class="flex flex-col gap-3">
				<h2 class="text-sm font-medium">Canvas Content</h2>
				<CanvasToolbar
					canUndo={editorRef?.getHistory()?.canUndo ?? false}
					canRedo={editorRef?.getHistory()?.canRedo ?? false}
					onAddRectangle={() => editorRef?.doAddRectangle()}
					onAddCircle={() => editorRef?.doAddCircle()}
					onAddText={() => editorRef?.doAddText()}
					onAddLine={() => editorRef?.doAddLine()}
					onDelete={() => editorRef?.doDeleteSelected()}
					onClear={() => editorRef?.doClearCanvas()}
					onUndo={() => editorRef?.doUndo()}
					onRedo={() => editorRef?.doRedo()}
					onZoomIn={() => editorRef?.getZoomPan()?.zoomIn()}
					onZoomOut={() => editorRef?.getZoomPan()?.zoomOut()}
					onZoomReset={() => editorRef?.getZoomPan()?.resetZoom()}
				/>
				<CanvasEditor
					bind:this={editorRef}
					width={800}
					height={600}
					onCanvasChange={page.updateCanvasData}
				/>
			</div>

			<div class="flex justify-end gap-3">
				<Button type="button" variant="outline" onclick={() => void goto('/marketing/canvas-templates')}>
					Cancel
				</Button>
				<Button type="submit" disabled={page.isSaving || !page.isValid}>
					{page.isSaving ? 'Saving...' : 'Save Template'}
				</Button>
			</div>
		</form>
	</div>
</MarketingShell>
