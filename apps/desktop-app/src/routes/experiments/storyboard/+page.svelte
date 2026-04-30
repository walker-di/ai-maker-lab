<script lang="ts">
	import {
		AddFramesDialog,
		CreateStoryboardDialog,
		ExportProgressPanel,
		StoryboardEditor,
		StoryboardErrorState,
		StoryboardList,
		StoryboardShell,
		ViewModeToggle,
		TimelineView,
		GridView,
		PreviewMode,
		BatchActionsBar,
		StoryboardModelConfig,
	} from 'ui/source/storyboard';
	import { Button } from 'ui/source';
	import { m } from '$lib/paraglide/messages.js';
	import { createStoryboardPageComposition } from './storyboard-page.composition';

	const model = createStoryboardPageComposition();
	$effect(() => { void model.load(); });

	let showConfig = $state(false);

	function errorCopy(model: ReturnType<typeof createStoryboardPageComposition>) {
		if (model.initialLoadError?.kind === 'backend-unavailable') {
			return {
				title: m.storyboard_error_backend_unavailable_title(),
				description: m.storyboard_error_backend_unavailable_description(),
				retryLabel: m.storyboard_error_backend_unavailable_retry(),
			};
		}
		if (model.initialLoadError?.kind === 'network') {
			return {
				title: m.storyboard_error_network_title(),
				description: m.storyboard_error_network_description(),
				retryLabel: m.storyboard_error_network_retry(),
			};
		}
		return {
			title: m.storyboard_error_server_title(),
			description: m.storyboard_error_server_description(),
			retryLabel: m.storyboard_error_server_retry(),
		};
	}
</script>

<StoryboardShell>
	{#if model.operationError}
		<div class="rounded-lg border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive">
			{model.operationError}
		</div>
	{/if}

	<ExportProgressPanel
		status={model.exportStatus}
		downloadUrl={model.exportUrl}
		error={model.operationError ?? undefined}
		onClose={() => (model.exportStatus = 'idle')}
	/>

	{#if model.initialLoadStatus === 'error' && model.initialLoadError}
		{@const copy = errorCopy(model)}
		<StoryboardErrorState
			title={copy.title}
			description={copy.description}
			technicalDetails={model.initialLoadError.technicalMessage}
			retryLabel={copy.retryLabel}
			onRetry={model.load}
			isRetrying={model.isLoading}
		/>
	{:else if model.selected}
		<!-- Editor Header -->
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div>
				<Button type="button" variant="ghost" class="mb-2 px-0" onclick={model.backToList}>← Back to storyboards</Button>
				<h1 class="text-3xl font-bold tracking-tight">{model.selected.name}</h1>
				<p class="text-muted-foreground text-sm">{model.selected.frameCount} frames</p>
			</div>
			<div class="flex flex-wrap items-center gap-2">
				<ViewModeToggle mode={model.viewMode} onModeChange={(m) => { model.viewMode = m; }} disabled={model.isLoading} />
				<Button type="button" variant="outline" size="sm" onclick={() => (showConfig = !showConfig)} disabled={model.isLoading}>
					{showConfig ? 'Hide AI config' : 'AI config'}
				</Button>
				<Button type="button" variant="outline" size="sm" onclick={() => (model.addFramesDialogOpen = true)} disabled={model.isLoading}>Generate frames</Button>
				<Button type="button" variant="outline" size="sm" onclick={() => model.insertBlankFrame()} disabled={model.isLoading}>Insert blank</Button>
				<Button type="button" size="sm" onclick={model.exportVideo} disabled={model.isLoading || model.selected.frames.length === 0}>Export video</Button>
			</div>
		</div>

		{#if showConfig && model.modelConfig}
			<StoryboardModelConfig
				textProvider={model.modelConfig.textProvider}
				textModel={model.modelConfig.textModel}
				imageProvider={model.modelConfig.imageProvider}
				imageModel={model.modelConfig.imageModel}
				onTextProviderChange={(v) => model.modelConfig = { ...model.modelConfig, textProvider: v, textModel: '' }}
				onTextModelChange={(v) => model.modelConfig = { ...model.modelConfig, textModel: v }}
				onImageProviderChange={(v) => model.modelConfig = { ...model.modelConfig, imageProvider: v, imageModel: '' }}
				onImageModelChange={(v) => model.modelConfig = { ...model.modelConfig, imageModel: v }}
				disabled={model.isLoading}
			/>
		{/if}

		<!-- Batch Actions -->
		<BatchActionsBar
			frameCount={model.selected.frames.length}
			onBatchGenerate={model.batchGenerateAssets}
			onBatchRegenerate={model.batchRegeneratePrompts}
			onAutoTransitions={() => model.autoAssignTransitions('uniform', 'fade', 500)}
			disabled={model.isLoading}
		/>

		<!-- View Modes -->
		{#if model.viewMode === 'preview'}
			<PreviewMode
				storyboard={model.selected}
				selectedFrameIndex={model.selectedFrameIndex}
				isPlaying={model.isPlaying}
				onTogglePlayback={model.togglePlayback}
				onNavigateFrame={model.navigateFrame}
				onSelectFrame={model.selectFrame}
				onExit={() => { model.viewMode = 'timeline'; }}
			/>
		{:else if model.viewMode === 'grid'}
			<GridView
				storyboard={model.selected}
				selectedFrameIndex={model.selectedFrameIndex}
				disabled={model.isLoading}
				onSelectFrame={model.selectFrame}
				onReorder={model.reorderFrame}
				onAddFrames={() => (model.addFramesDialogOpen = true)}
			/>
		{:else}
			<TimelineView
				storyboard={model.selected}
				selectedFrameIndex={model.selectedFrameIndex}
				disabled={model.isLoading}
				onSelectFrame={model.selectFrame}
				onNavigateFrame={model.navigateFrame}
				onAddFrames={() => (model.addFramesDialogOpen = true)}
				onSaveText={model.saveFrameText}
				onDelete={model.deleteFrame}
				onDuplicate={model.duplicateFrame}
				onRegeneratePrompt={model.regeneratePrompt}
				onGenerateAsset={model.generateAsset}
				onUpdateTransition={model.updateTransition}
			/>
		{/if}
	{:else}
		<div class="flex flex-wrap items-start justify-between gap-4">
			<div>
				<h1 class="text-3xl font-bold tracking-tight">{m.storyboard_page_title()}</h1>
				<p class="text-muted-foreground text-sm">
					{m.storyboard_page_description()}
				</p>
			</div>
		</div>
		<StoryboardList
			storyboards={model.storyboards}
			onOpen={model.open}
			onCreate={() => { if (!model.isBackendUnavailable) model.createDialogOpen = true; }}
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
