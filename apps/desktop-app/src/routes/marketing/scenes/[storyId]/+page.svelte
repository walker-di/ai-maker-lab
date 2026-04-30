<script lang="ts">
	import { goto } from '$app/navigation';
	import { page as pageStore } from '$app/stores';
	import {
		Button,
		MarketingShell,
		MarketingEmptyState,
		SceneList,
		CanvasEditor,
		CanvasToolbar,
	} from 'ui/source';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import LayersIcon from '@lucide/svelte/icons/layers';
	import { m } from '$lib/paraglide/messages.js';
	import { createSceneEditorPage } from '../scene-editor-page.composition.js';

	const storyId = $derived($pageStore.params.storyId);
	const page = createSceneEditorPage(storyId);
	let editorRef: ReturnType<typeof CanvasEditor> | undefined = $state();

	function navigate(path: string) {
		void goto(`/marketing${path}`);
	}

	function handleAddScene() {
		if (!page.storyId) return;
		void page.createScene({
			storyId: page.storyId,
			orderIndex: page.scenes.length,
			description: `Scene ${page.scenes.length + 1}`,
		});
	}

	function handleSceneCanvasChange(json: string) {
		if (!page.activeScene) return;
		void page.updateScene(page.activeScene.id, { canvasData: json });
	}
</script>

<svelte:head>
	<title>Scene Editor</title>
</svelte:head>

<MarketingShell activePath="/scenes" onNavigate={navigate}>
	<div class="flex h-full">
		<!-- Left panel: Scene list -->
		<aside class="w-72 shrink-0 overflow-y-auto border-r bg-card p-4">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-sm font-semibold">Scenes</h2>
				<Button variant="ghost" size="icon" class="h-7 w-7" onclick={handleAddScene} title="Add Scene">
					<PlusIcon class="h-4 w-4" />
				</Button>
			</div>

			{#if page.isLoading}
				<p class="text-muted-foreground text-center text-xs">Loading...</p>
			{:else if page.hasScenes}
				<SceneList
					scenes={page.scenes}
					activeSceneId={page.activeSceneId ?? undefined}
					onSelectScene={(id) => void page.selectScene(id)}
					onDeleteScene={(id) => void page.deleteScene(id)}
					onAddScene={handleAddScene}
				/>
			{:else}
				<div class="text-muted-foreground rounded-md border border-dashed p-4 text-center text-xs">
					<p>No scenes yet.</p>
					<Button variant="link" size="sm" class="mt-2" onclick={handleAddScene}>
						Add your first scene
					</Button>
				</div>
			{/if}
		</aside>

		<!-- Right panel: Scene detail -->
		<main class="flex flex-1 flex-col overflow-y-auto p-6">
			{#if page.activeScene}
				<div class="flex flex-col gap-4">
					<h2 class="text-lg font-semibold">
						{page.activeScene.description ?? `Scene ${page.activeScene.orderIndex + 1}`}
					</h2>

					{#if page.errorMessage}
						<p class="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
							{page.errorMessage}
						</p>
					{/if}

					<div class="flex flex-col gap-3">
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
							canvasData={page.activeScene.canvasData ?? undefined}
							onCanvasChange={handleSceneCanvasChange}
						/>
					</div>

					<!-- Clips section -->
					<div class="mt-6">
						<div class="mb-3 flex items-center justify-between">
							<h3 class="text-sm font-semibold">Clips ({page.clips.length})</h3>
							<Button
								variant="outline"
								size="sm"
								onclick={() => void page.createClip({ sceneId: page.activeScene!.id, orderIndex: page.clips.length, type: 'text' })}
							>
								<PlusIcon class="mr-1 h-3 w-3" /> Add Clip
							</Button>
						</div>
						{#if page.clips.length > 0}
							<div class="flex flex-col gap-2">
								{#each page.clips as clip (clip.id)}
									<div class="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm">
										<div class="flex items-center gap-2">
											<span class="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">{clip.type}</span>
											<span class="text-muted-foreground truncate max-w-[200px]">
												{clip.content ?? clip.narrationText ?? '(empty)'}
											</span>
										</div>
										<Button variant="ghost" size="icon" class="h-6 w-6 text-destructive" onclick={() => void page.deleteClip(clip.id)}>
											×
										</Button>
									</div>
								{/each}
							</div>
						{:else}
							<p class="text-muted-foreground rounded-md border border-dashed p-3 text-center text-xs">No clips in this scene.</p>
						{/if}
					</div>
				</div>
			{:else}
				<div class="flex flex-1 items-center justify-center">
					<MarketingEmptyState
						title="Select a Scene"
						description="Choose a scene from the left panel to edit its canvas and clips."
					>
						{#snippet icon()}
							<LayersIcon class="h-6 w-6" />
						{/snippet}
					</MarketingEmptyState>
				</div>
			{/if}
		</main>
	</div>
</MarketingShell>
