import type { StoryboardTransport } from '$lib/adapters/storyboard/StoryboardTransport';
import type { Marketing } from 'domain/shared';
import { StoryboardTransportError } from '$lib/adapters/storyboard/web-storyboard-transport';

export interface StoryboardModelConfigState {
	textProvider: string;
	textModel: string;
	imageProvider: string;
	imageModel: string;
	audioProvider?: Marketing.StoryboardAudioProvider;
	audioModel?: string;
	audioVoice?: string;
	audioLanguage?: string;
}

function optionalText(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

function toStoryboardModelConfig(config: StoryboardModelConfigState): Marketing.StoryboardModelConfig {
	return {
		textProvider: optionalText(config.textProvider) as Marketing.StoryboardTextModelProvider | undefined,
		textModel: optionalText(config.textModel) as Marketing.StoryboardTextModel | undefined,
		imageProvider: optionalText(config.imageProvider) as Marketing.StoryboardImageModelProvider | undefined,
		imageModel: optionalText(config.imageModel) as Marketing.StoryboardImageModel | undefined,
		audioProvider: config.audioProvider,
		audioModel: optionalText(config.audioModel),
		audioVoice: optionalText(config.audioVoice),
		audioLanguage: optionalText(config.audioLanguage),
	};
}

export function createStoryboardPageModel(transport: StoryboardTransport) {
	let storyboards: Awaited<ReturnType<StoryboardTransport['listStoryboards']>> = [];
	let selected: Awaited<ReturnType<StoryboardTransport['getStoryboard']>> | null = null;
	let isLoading = false;
	let initialLoadStatus: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
	let initialLoadError: StoryboardTransportError | null = null;
	let operationError: string | null = null;
	let createDialogOpen = false;
	let addFramesDialogOpen = false;
	let exportStatus: 'idle' | 'exporting' | 'done' | 'error' = 'idle';
	let exportUrl: string | undefined;
	let viewMode: 'timeline' | 'grid' | 'preview' = 'timeline';
	let selectedFrameIndex = 0;
	let isPlaying = false;
	let playbackTimer: ReturnType<typeof setInterval> | null = null;
	let modelConfig: StoryboardModelConfigState = {
		textProvider: 'openai',
		textModel: 'gpt-4o-mini',
		imageProvider: 'openai',
		imageModel: 'gpt-image-1',
		audioProvider: 'azure',
		audioModel: '',
		audioVoice: '',
		audioLanguage: '',
	};

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
		const mc = toStoryboardModelConfig(modelConfig);
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
		const mc = toStoryboardModelConfig(modelConfig);
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
		get isBackendUnavailable() { return initialLoadError?.kind === 'backend-unavailable'; },
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
		get selectedFrame() { return selected?.frames[selectedFrameIndex] ?? null; },
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
