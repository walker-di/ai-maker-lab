import type {
	StoryboardNarrationOptions,
	StoryboardTransport,
} from '$lib/adapters/storyboard/StoryboardTransport';
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
	let storyboards = $state<Awaited<ReturnType<StoryboardTransport['listStoryboards']>>>([]);
	let selected = $state<Awaited<ReturnType<StoryboardTransport['getStoryboard']>> | null>(null);
	let isLoading = $state(false);
	let initialLoadStatus = $state<'idle' | 'loading' | 'ready' | 'error'>('idle');
	let initialLoadError = $state<StoryboardTransportError | null>(null);
	let operationError = $state<string | null>(null);
	let createDialogOpen = $state(false);
	let addFramesDialogOpen = $state(false);
	let exportStatus = $state<'idle' | 'exporting' | 'done' | 'error'>('idle');
	let exportUrl = $state<string | undefined>(undefined);
	let viewMode = $state<'timeline' | 'grid' | 'preview'>('timeline');
	let selectedFrameIndex = $state(0);
	let isPlaying = $state(false);
	let playbackTimer: ReturnType<typeof setInterval> | null = null;
	let modelConfig = $state<StoryboardModelConfigState>({
		textProvider: 'openai',
		textModel: 'gpt-4o-mini',
		imageProvider: 'openai',
		imageModel: 'gpt-image-1',
		audioProvider: 'azure',
		audioModel: '',
		audioVoice: '',
		audioLanguage: '',
	});
	let narrationOptions = $state<StoryboardNarrationOptions>({
		provider: 'azure',
		supportsLocalModelDownload: false,
		models: [],
		voices: [],
		languages: [],
	});
	let narrationModelStatus = $state<'idle' | 'checking' | 'missing' | 'downloading' | 'ready' | 'error'>('idle');
	let narrationOptionsRequestId = 0;

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

	function resolveSelectedNarrationOption(
		currentValue: string | undefined,
		options: StoryboardNarrationOptions['models'] | StoryboardNarrationOptions['voices'] | StoryboardNarrationOptions['languages'],
	): string {
		if (currentValue && options.some((option) => option.value === currentValue)) {
			return currentValue;
		}
		if (options.length === 0) {
			return currentValue ?? '';
		}
		return options[0]?.value ?? '';
	}

	function syncNarrationConfig(options: StoryboardNarrationOptions) {
		const nextAudioModel = resolveSelectedNarrationOption(modelConfig.audioModel, options.models);
		const nextAudioVoice = resolveSelectedNarrationOption(modelConfig.audioVoice, options.voices);
		const nextAudioLanguage = resolveSelectedNarrationOption(modelConfig.audioLanguage, options.languages);
		if (
			nextAudioModel !== (modelConfig.audioModel ?? '')
			|| nextAudioVoice !== (modelConfig.audioVoice ?? '')
			|| nextAudioLanguage !== (modelConfig.audioLanguage ?? '')
		) {
			modelConfig = {
				...modelConfig,
				audioModel: nextAudioModel,
				audioVoice: nextAudioVoice,
				audioLanguage: nextAudioLanguage,
			};
		}
	}

	async function loadNarrationOptions(input?: { provider?: Marketing.StoryboardAudioProvider; model?: string }) {
		const provider = input?.provider ?? modelConfig.audioProvider ?? 'azure';
		const model = optionalText(input?.model ?? modelConfig.audioModel);
		const requestId = ++narrationOptionsRequestId;
		try {
			const options = await transport.getNarrationOptions({ provider, model });
			if (requestId !== narrationOptionsRequestId) return;
			if ((modelConfig.audioProvider ?? 'azure') !== provider) return;
			narrationOptions = options;
			syncNarrationConfig(options);
		} catch (cause) {
			if (requestId !== narrationOptionsRequestId) return;
			if ((modelConfig.audioProvider ?? 'azure') !== provider) return;
			if (cause instanceof StoryboardTransportError) {
				operationError = cause.technicalMessage
					? `${cause.message} (${cause.technicalMessage})`
					: cause.message;
			} else {
				operationError = cause instanceof Error ? cause.message : 'Unknown storyboard error';
			}
		}
	}

	async function setAudioProvider(provider: Marketing.StoryboardAudioProvider) {
		modelConfig = {
			...modelConfig,
			audioProvider: provider,
		};
		narrationModelStatus = 'idle';
		await loadNarrationOptions({ provider });
	}

	async function setAudioModel(model: string) {
		modelConfig = {
			...modelConfig,
			audioModel: model,
		};
		narrationModelStatus = 'idle';
		await loadNarrationOptions({ provider: modelConfig.audioProvider ?? 'azure', model });
	}

	async function checkNarrationModelStatus() {
		const provider = modelConfig.audioProvider ?? 'azure';
		const model = optionalText(modelConfig.audioModel);
		if (!model) {
			narrationModelStatus = 'idle';
			return;
		}
		narrationModelStatus = 'checking';
		try {
			const status = await transport.getNarrationModelStatus({ provider, model });
			narrationModelStatus = status.local ? 'ready' : 'missing';
		} catch (cause) {
			narrationModelStatus = 'error';
			if (cause instanceof StoryboardTransportError) {
				operationError = cause.technicalMessage
					? `${cause.message} (${cause.technicalMessage})`
					: cause.message;
			} else {
				operationError = cause instanceof Error ? cause.message : 'Unknown storyboard error';
			}
		}
	}

	async function downloadNarrationModel() {
		const provider = modelConfig.audioProvider ?? 'azure';
		const model = optionalText(modelConfig.audioModel);
		if (!model) {
			operationError = 'Select an audio model before downloading.';
			return;
		}
		narrationModelStatus = 'downloading';
		operationError = null;
		try {
			await transport.downloadNarrationModel({ provider, model });
			narrationModelStatus = 'ready';
		} catch (cause) {
			narrationModelStatus = 'error';
			if (cause instanceof StoryboardTransportError) {
				operationError = cause.technicalMessage
					? `${cause.message} (${cause.technicalMessage})`
					: cause.message;
			} else {
				operationError = cause instanceof Error ? cause.message : 'Unknown storyboard error';
			}
		}
	}

	async function load() {
		initialLoadStatus = 'loading';
		initialLoadError = null;
		isLoading = true;
		try {
			storyboards = await transport.listStoryboards();
			await loadNarrationOptions();
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

	async function create(input: { name: string; description?: string }): Promise<boolean> {
		const created = await run(async () => transport.createStoryboard(input));
		if (!created) return false;
		createDialogOpen = false;
		await load();
		await open(created.id);
		return true;
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

	function isBackendUnavailable() {
		return initialLoadError?.kind === 'backend-unavailable';
	}

	function openCreateDialog() {
		if (isBackendUnavailable()) {
			operationError = 'The storyboard service is temporarily unavailable. Please try again shortly.';
			return;
		}
		operationError = null;
		createDialogOpen = true;
	}

	return {
		get storyboards() { return storyboards; },
		get selected() { return selected; },
		get isLoading() { return isLoading; },
		get initialLoadStatus() { return initialLoadStatus; },
		get initialLoadError() { return initialLoadError; },
		get operationError() { return operationError; },
		get isBackendUnavailable() { return isBackendUnavailable(); },
		get createDialogOpen() { return createDialogOpen; },
		set createDialogOpen(v) { createDialogOpen = v; },
		get addFramesDialogOpen() { return addFramesDialogOpen; },
		set addFramesDialogOpen(v) { addFramesDialogOpen = v; },
		get exportStatus() { return exportStatus; },
		set exportStatus(v) { exportStatus = v; },
		get exportUrl() { return exportUrl; },
		get modelConfig() { return modelConfig; },
		set modelConfig(v) { modelConfig = v; narrationModelStatus = 'idle'; },
		get narrationOptions() { return narrationOptions; },
		get narrationModelStatus() { return narrationModelStatus; },
		get viewMode() { return viewMode; },
		set viewMode(v) { viewMode = v; },
		get selectedFrameIndex() { return selectedFrameIndex; },
		get selectedFrame() { return selected?.frames[selectedFrameIndex] ?? null; },
		get isPlaying() { return isPlaying; },
		load,
		create,
		openCreateDialog,
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
		setAudioProvider,
		setAudioModel,
		loadNarrationOptions,
		checkNarrationModelStatus,
		downloadNarrationModel,
	};
}
