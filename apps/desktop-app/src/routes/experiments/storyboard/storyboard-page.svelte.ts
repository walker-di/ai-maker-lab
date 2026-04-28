import type { StoryboardTransport } from '$lib/adapters/storyboard/StoryboardTransport';

export function createStoryboardPageModel(transport: StoryboardTransport) {
	let storyboards = $state<Awaited<ReturnType<StoryboardTransport['listStoryboards']>>>([]);
	let selected = $state<Awaited<ReturnType<StoryboardTransport['getStoryboard']>> | null>(null);
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let createDialogOpen = $state(false);
	let addFramesDialogOpen = $state(false);
	let exportStatus = $state<'idle' | 'exporting' | 'done' | 'error'>('idle');
	let exportUrl = $state<string | undefined>();

	async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
		isLoading = true;
		error = null;
		try {
			return await fn();
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Unknown storyboard error';
		} finally {
			isLoading = false;
		}
	}

	async function load() {
		await run(async () => { storyboards = await transport.listStoryboards(); });
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
		await run(async () => { selected = await transport.generateFrames(selected!.id, input); });
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
		await run(async () => { await transport.generateFrameAsset(selected!.id, frameId, assetType); await refreshSelected(); });
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

	return {
		get storyboards() { return storyboards; },
		get selected() { return selected; },
		get isLoading() { return isLoading; },
		get error() { return error; },
		get createDialogOpen() { return createDialogOpen; },
		set createDialogOpen(v) { createDialogOpen = v; },
		get addFramesDialogOpen() { return addFramesDialogOpen; },
		set addFramesDialogOpen(v) { addFramesDialogOpen = v; },
		get exportStatus() { return exportStatus; },
		set exportStatus(v) { exportStatus = v; },
		get exportUrl() { return exportUrl; },
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
	};
}
