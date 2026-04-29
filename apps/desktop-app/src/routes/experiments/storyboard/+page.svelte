<script lang="ts">
	import {
		AddFramesDialog,
		CreateStoryboardDialog,
		ExportProgressPanel,
		StoryboardEditor,
		StoryboardErrorState,
		StoryboardList,
		StoryboardShell,
	} from 'ui/source/storyboard';
	import { m } from '$lib/paraglide/messages.js';
	import { createStoryboardPageComposition } from './storyboard-page.composition';

	const model = createStoryboardPageComposition();
	$effect(() => { void model.load(); });

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
