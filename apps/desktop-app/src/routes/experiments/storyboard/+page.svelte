<script lang="ts">
	import {
		AddFramesDialog,
		CreateStoryboardDialog,
		ExportProgressPanel,
		StoryboardEditor,
		StoryboardList,
		StoryboardShell,
	} from 'ui/source';
	import { createStoryboardPageComposition } from './storyboard-page.composition';

	const model = createStoryboardPageComposition();
	$effect(() => { void model.load(); });
</script>

<StoryboardShell>
	{#if model.error}
		<div class="rounded-lg border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive">
			{model.error}
		</div>
	{/if}

	<ExportProgressPanel
		status={model.exportStatus}
		downloadUrl={model.exportUrl}
		error={model.error ?? undefined}
		onClose={() => (model.exportStatus = 'idle')}
	/>

	{#if model.selected}
		<StoryboardEditor
			storyboard={model.selected}
			isLoading={model.isLoading}
			onBack={model.backToList}
			onAddFrames={() => (model.addFramesDialogOpen = true)}
			onInsertBlankFrame={model.insertBlankFrame}
			onSaveText={model.saveFrameText}
			onReorder={model.reorderFrame}
			onDelete={model.deleteFrame}
			onRegeneratePrompt={model.regeneratePrompt}
			onGenerateAsset={model.generateAsset}
			onUpdateTransition={model.updateTransition}
			onExport={model.exportVideo}
		/>
	{:else}
		<div class="flex flex-wrap items-start justify-between gap-4">
			<div>
				<h1 class="text-3xl font-bold tracking-tight">AI Storyboard Maker</h1>
				<p class="text-muted-foreground text-sm">
					Create prompt-driven storyboards with generated frames, assets, transitions, and export.
				</p>
			</div>
		</div>
		<StoryboardList
			storyboards={model.storyboards}
			onOpen={model.open}
			onCreate={() => (model.createDialogOpen = true)}
		/>
	{/if}

	<CreateStoryboardDialog
		open={model.createDialogOpen}
		onOpenChange={(open) => (model.createDialogOpen = open)}
		onCreate={model.create}
		isLoading={model.isLoading}
	/>

	<AddFramesDialog
		open={model.addFramesDialogOpen}
		onOpenChange={(open) => (model.addFramesDialogOpen = open)}
		onGenerate={model.generateFrames}
		isLoading={model.isLoading}
	/>
</StoryboardShell>
