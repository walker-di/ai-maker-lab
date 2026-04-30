import type { StoryboardTransport } from '$lib/adapters/storyboard/StoryboardTransport';
import type { Marketing } from 'domain/shared';
import { StoryboardTransportError } from '$lib/adapters/storyboard/web-storyboard-transport';

export interface StoryboardModelConfigState {
	textProvider: string;
	textModel: string;
	imageProvider: string;
	imageModel: string;
}

export function createStoryboardPageModel(transport: StoryboardTransport) {
	let storyboards = $state<Awaited<ReturnType<StoryboardTransport['listStoryboards']>>>([]);
	let selected = $state<Awaited<ReturnType<StoryboardTransport['getStoryboard']>> | null>(null);
	let isLoading = $state(false);
	let initialLoadStatus = $state<'idle' | 'loading' | 'ready' | 'error'>('idle');
	let initialLoadError = $state<StoryboardTransportError | null>(null);
	let operationError = $state<string | null>(null);
	let createDialogOpen = $state(false);
	let addFramesDialogOpen = $state(false);
	let exportStatus = $state<'idle' | 'exporting' | 'done' | 'error'>('idle');
	let exportUrl = $state<string | undefined>();
	let viewMode = $state<'timeline' | 'grid' | 'preview'>('timeline');
	let selectedFrameIndex = $state(0);
	let isPlaying = $state(false);
	let playbackTimer = $state<ReturnType<typeof setInterval> | null>(null);
	let modelConfig = $state<StoryboardModelConfigState>({
		textProvider: 'openai',
		textModel: 'gpt-4o-mini',
		imageProvider: 'openai',
		imageModel: 'gpt-image-1',
	});

	const isBackendUnavailable = $derived(
		initialLoadError?.kind === 'backend-unavailable',
	);

	async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
		isLoading = true;
		operationError = null;
		try {
			return await fn();
		} catch (cause) {
			if (cause instanceof StoryboardTransportError) {
				operationError = cause.technicalMessage
					? `${cause.message} (${cause.technicalMessage})`
					: cause.message;
			} else {
				operationError = cause instanceof Error ? cause.message : 'Unknown storyboard error';
			}
		} finally {
			isLoading = false;
		}
	}

	async function load() {
		initialLoadStatus = 'loading';
		initialLoadError = null;
		isLoading = true;
		try {
			storyboards = await transport.listStoryboards();
			initialLoadStatus = 'ready';
		} catch (cause) {
			initialLoadStatus = 'error';
			initialLoadError = cause instanceof StoryboardTransportError
				? cause
				: new StoryboardTransportError({
					kind: 'server',
					userMessage: cause instanceof Error ? cause.message : 'Unknown storyboard error',
					technicalMessage: cause instanceof Error ? cause.message : undefined,
				});
		} finally {
			isLoading = false;
		}
	}

	async function create(input: { name: string; description?: string }) {
		const created = await run(async () => transport.createStoryboard(input));
		if (!created) return;
		createDialogOpen = false;
		await load();
		await open(created.id);
	}

	async function open(id: string) {
		await run(async () => { selected = await transport.getStoryboard(id); });
	}

	function backToList() { selected = null; }

	async function refreshSelected() {
		if (!selected) return;
		selected = await transport.getStoryboard(selected.id);
	}

	async function generateFrames(input: { prompt: string; count: number }) {
		if (!selected) return;
		const mc: Marketing.StoryboardModelConfig | undefined =
			modelConfig.textProvider && modelConfig.textModel
				? {
						textProvider: modelConfig.textProvider as Marketing.StoryboardTextModelProvider,
						textModel: modelConfig.textModel as Marketing.StoryboardTextModel,
						imageProvider: modelConfig.imageProvider as Marketing.StoryboardImageModelProvider,
						imageModel: modelConfig.imageModel as Marketing.StoryboardImageModel,
					}
				: undefined;
		await run(async () => { selected = await transport.generateFrames(selected!.id, { ...input, modelConfig: mc }); });
		addFramesDialogOpen = false;
		await load();
	}

	async function insertBlankFrame(afterFrameId?: string) {
		if (!selected) return;
		await run(async () => { selected = await transport.insertBlankFrame(selected!.id, { afterFrameId }); });
		await load();
	}

	async function saveFrameText(frameId: string, input: { title?: string; narration?: string; mainImagePrompt?: string; backgroundImagePrompt?: string; bgmPrompt?: string }) {
		if (!selected) return;
		await run(async () => { await transport.updateFrameText(selected!.id, frameId, input); await refreshSelected(); });
	}

	async function reorderFrame(frameId: string, direction: 'up' | 'down') {
		if (!selected) return;
		await run(async () => { selected = await transport.reorderFrame(selected!.id, frameId, { direction }); });
	}

	async function deleteFrame(frameId: string) {
		if (!selected) return;
		await run(async () => { selected = await transport.deleteFrame(selected!.id, frameId); });
		await load();
	}

	async function regeneratePrompt(frameId: string, promptType: 'narration' | 'mainImage' | 'backgroundImage' | 'bgm') {
		if (!selected) return;
		await run(async () => { await transport.regeneratePrompt(selected!.id, frameId, promptType); await refreshSelected(); });
	}

	async function generateAsset(frameId: string, assetType: 'mainImage' | 'backgroundImage' | 'narrationAudio' | 'bgm') {
		if (!selected) return;
		const mc: Marketing.StoryboardModelConfig | undefined =
			modelConfig.imageProvider && modelConfig.imageModel
				? {
						imageProvider: modelConfig.imageProvider as Marketing.StoryboardImageModelProvider,
						imageModel: modelConfig.imageModel as Marketing.StoryboardImageModel,
						textProvider: modelConfig.textProvider as Marketing.StoryboardTextModelProvider,
						textModel: modelConfig.textModel as Marketing.StoryboardTextModel,
					}
				: undefined;
		await run(async () => { await transport.generateFrameAsset(selected!.id, frameId, assetType, mc); await refreshSelected(); });
	}

	async function updateTransition(frameId: string, input: { transitionTypeAfter: 'none' | 'fade' | 'slide' | 'wipe' | 'zoom'; transitionDurationMs: number }) {
		if (!selected) return;
		await run(async () => { await transport.updateTransition(selected!.id, frameId, input); await refreshSelected(); });
	}

	async function exportVideo() {
		if (!selected) return;
		exportStatus = 'exporting';
		const result = await run(async () => transport.exportUnifiedVideo(selected!.id));
		if (result) {
			exportStatus = 'done';
			exportUrl = result.downloadUrl ?? result.videoPath;
		} else {
			exportStatus = 'error';
		}
	}

	const selectedFrame = $derived(selected?.frames[selectedFrameIndex] ?? null);

	function selectFrame(index: number) {
		if (selected && index >= 0 && index < selected.frames.length) {
			selectedFrameIndex = index;
		}
	}

	function navigateFrame(direction: 'prev' | 'next') {
		if (!selected) return;
		const next = direction === 'prev' ? selectedFrameIndex - 1 : selectedFrameIndex + 1;
		if (next >= 0 && next < selected.frames.length) {
			selectedFrameIndex = next;
		}
	}

	function togglePlayback() {
		if (isPlaying) {
			if (playbackTimer) clearInterval(playbackTimer);
			playbackTimer = null;
			isPlaying = false;
		} else {
			if (!selected || selected.frames.length === 0) return;
			isPlaying = true;
			playbackTimer = setInterval(() => {
				if (!selected) { togglePlayback(); return; }
				const next = selectedFrameIndex + 1;
				if (next >= selected.frames.length) {
					selectedFrameIndex = 0;
					togglePlayback();
				} else {
					selectedFrameIndex = next;
				}
			}, selected.frames[selectedFrameIndex]?.durationMs ?? 3000);
		}
	}

	async function batchGenerateAssets() {
		if (!selected) return;
		await run(async () => { selected = await transport.batchGenerateAssets(selected!.id); });
	}

	async function batchRegeneratePrompts() {
		if (!selected) return;
		await run(async () => { selected = await transport.batchRegeneratePrompts(selected!.id); });
	}

	async function autoAssignTransitions(strategy: 'uniform' | 'alternating' = 'uniform', transitionType?: string, durationMs?: number) {
		if (!selected) return;
		await run(async () => {
			selected = await transport.autoAssignTransitions(selected!.id, {
				strategy,
				transitionType: transitionType as 'none' | 'fade' | 'slide' | 'wipe' | 'zoom' | undefined,
				durationMs: durationMs ?? 500,
			});
		});
	}

	async function duplicateFrame(frameId: string) {
		if (!selected) return;
		await run(async () => { selected = await transport.duplicateFrame(selected!.id, frameId); });
		await load();
	}

	return {
		get storyboards() { return storyboards; },
		get selected() { return selected; },
		get isLoading() { return isLoading; },
		get initialLoadStatus() { return initialLoadStatus; },
		get initialLoadError() { return initialLoadError; },
		get operationError() { return operationError; },
		get isBackendUnavailable() { return isBackendUnavailable; },
		get createDialogOpen() { return createDialogOpen; },
		set createDialogOpen(v) { createDialogOpen = v; },
		get addFramesDialogOpen() { return addFramesDialogOpen; },
		set addFramesDialogOpen(v) { addFramesDialogOpen = v; },
		get exportStatus() { return exportStatus; },
		set exportStatus(v) { exportStatus = v; },
		get exportUrl() { return exportUrl; },
		get modelConfig() { return modelConfig; },
		set modelConfig(v) { modelConfig = v; },
		get viewMode() { return viewMode; },
		set viewMode(v) { viewMode = v; },
		get selectedFrameIndex() { return selectedFrameIndex; },
		get selectedFrame() { return selectedFrame; },
		get isPlaying() { return isPlaying; },
		load,
		create,
		open,
		backToList,
		generateFrames,
		insertBlankFrame,
		saveFrameText,
		reorderFrame,
		deleteFrame,
		regeneratePrompt,
		generateAsset,
		updateTransition,
		exportVideo,
		selectFrame,
		navigateFrame,
		togglePlayback,
		batchGenerateAssets,
		batchRegeneratePrompts,
		autoAssignTransitions,
		duplicateFrame,
	};
}
