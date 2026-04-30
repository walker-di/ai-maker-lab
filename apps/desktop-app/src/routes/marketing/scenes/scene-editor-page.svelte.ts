import type { MarketingTransport } from '$lib/adapters/marketing/create-marketing-transport.js';
import type { Scene, Clip, CreateSceneDto, UpdateSceneDto, CreateClipDto, UpdateClipDto } from '$lib/adapters/marketing/MarketingTransport.js';

interface CreateSceneEditorPageModelInput {
	transport: MarketingTransport;
}

export function createSceneEditorPageModel({ transport }: CreateSceneEditorPageModelInput) {
	let scenes = $state<Scene[]>([]);
	let activeSceneId = $state<string | null>(null);
	let clips = $state<Clip[]>([]);
	let storyId = $state<string | null>(null);
	let isLoading = $state(false);
	let isSaving = $state(false);
	let errorMessage = $state<string | null>(null);

	const orderedScenes = $derived([...scenes].sort((a, b) => a.orderIndex - b.orderIndex));
	const activeScene = $derived(scenes.find((s) => s.id === activeSceneId) ?? null);
	const orderedClips = $derived([...clips].sort((a, b) => a.orderIndex - b.orderIndex));
	const hasScenes = $derived(scenes.length > 0);

	async function apply(action: () => Promise<void>) {
		try {
			errorMessage = null;
			isSaving = true;
			await action();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Request failed.';
			console.error(error);
		} finally {
			isSaving = false;
		}
	}

	async function loadScenes(id: string) {
		storyId = id;
		try {
			isLoading = true;
			errorMessage = null;
			scenes = await transport.catalog.listScenes(id);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Failed to load scenes.';
			console.error(error);
		} finally {
			isLoading = false;
		}
	}

	async function selectScene(id: string) {
		activeSceneId = id;
		clips = await transport.catalog.listClips(id);
	}

	async function createScene(data: CreateSceneDto) {
		await apply(async () => {
			await transport.catalog.createScene(data);
			if (storyId) scenes = await transport.catalog.listScenes(storyId);
		});
	}

	async function updateScene(id: string, data: UpdateSceneDto) {
		await apply(async () => {
			await transport.catalog.updateScene(id, data);
			if (storyId) scenes = await transport.catalog.listScenes(storyId);
		});
	}

	async function deleteScene(id: string) {
		await apply(async () => {
			await transport.catalog.deleteScene(id);
			if (id === activeSceneId) {
				activeSceneId = null;
				clips = [];
			}
			if (storyId) scenes = await transport.catalog.listScenes(storyId);
		});
	}

	async function createClip(data: CreateClipDto) {
		await apply(async () => {
			await transport.catalog.createClip(data);
			if (activeSceneId) clips = await transport.catalog.listClips(activeSceneId);
		});
	}

	async function updateClip(id: string, data: UpdateClipDto) {
		await apply(async () => {
			await transport.catalog.updateClip(id, data);
			if (activeSceneId) clips = await transport.catalog.listClips(activeSceneId);
		});
	}

	async function deleteClip(id: string) {
		await apply(async () => {
			await transport.catalog.deleteClip(id);
			if (activeSceneId) clips = await transport.catalog.listClips(activeSceneId);
		});
	}

	return {
		get scenes() { return orderedScenes; },
		get activeScene() { return activeScene; },
		get activeSceneId() { return activeSceneId; },
		get clips() { return orderedClips; },
		get isLoading() { return isLoading; },
		get isSaving() { return isSaving; },
		get hasScenes() { return hasScenes; },
		get errorMessage() { return errorMessage; },
		get storyId() { return storyId; },
		loadScenes,
		selectScene,
		createScene,
		updateScene,
		deleteScene,
		createClip,
		updateClip,
		deleteClip,
	};
}
