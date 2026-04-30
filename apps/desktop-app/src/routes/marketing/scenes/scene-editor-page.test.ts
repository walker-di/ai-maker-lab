import { describe, expect, test, vi } from 'vitest';
import { createSceneEditorPageModel } from './scene-editor-page.svelte';
import type { MarketingTransport } from '$lib/adapters/marketing/create-marketing-transport';
import type { Scene, Clip } from '$lib/adapters/marketing/MarketingTransport';

function makeScene(id: string, orderIndex: number): Scene {
	const now = '2026-01-01T00:00:00.000Z';
	return {
		id,
		storyId: 'story-1',
		orderIndex,
		description: `Scene ${orderIndex + 1}`,
		durationMs: 5000,
		createdAt: now,
		updatedAt: now,
	};
}

function makeClip(id: string, orderIndex: number): Clip {
	const now = '2026-01-01T00:00:00.000Z';
	return {
		id,
		sceneId: 'scene-1',
		orderIndex,
		type: 'text',
		content: `Clip ${orderIndex + 1}`,
		createdAt: now,
		updatedAt: now,
	};
}

function createTransportStub() {
	const state = {
		scenes: [makeScene('scene-1', 0), makeScene('scene-2', 1)],
		clips: [makeClip('clip-1', 0), makeClip('clip-2', 1)],
	};

	const catalog = {
		listScenes: vi.fn(async () => [...state.scenes]),
		createScene: vi.fn(async (data: object) => {
			const scene = { ...makeScene(`scene-${state.scenes.length + 1}`, state.scenes.length), ...data };
			state.scenes.push(scene);
			return scene;
		}),
		updateScene: vi.fn(async (id: string, data: object) => {
			const idx = state.scenes.findIndex((s) => s.id === id);
			if (idx >= 0) state.scenes[idx] = { ...state.scenes[idx], ...data };
			return state.scenes[idx];
		}),
		deleteScene: vi.fn(async (id: string) => {
			state.scenes = state.scenes.filter((s) => s.id !== id);
		}),
		listClips: vi.fn(async () => [...state.clips]),
		createClip: vi.fn(async (data: object) => {
			const clip = { ...makeClip(`clip-${state.clips.length + 1}`, state.clips.length), ...data };
			state.clips.push(clip);
			return clip;
		}),
		updateClip: vi.fn(async (id: string, data: object) => {
			const idx = state.clips.findIndex((c) => c.id === id);
			if (idx >= 0) state.clips[idx] = { ...state.clips[idx], ...data };
			return state.clips[idx];
		}),
		deleteClip: vi.fn(async (id: string) => {
			state.clips = state.clips.filter((c) => c.id !== id);
		}),
	};

	const transport = { catalog } as unknown as MarketingTransport;
	return { state, catalog, transport };
}

describe('scene editor page model', () => {
	test('loadScenes() populates scenes', async () => {
		const { transport } = createTransportStub();
		const model = createSceneEditorPageModel({ transport });

		await model.loadScenes('story-1');

		expect(model.scenes).toHaveLength(2);
		expect(model.hasScenes).toBe(true);
		expect(model.isLoading).toBe(false);
	});

	test('selectScene() sets activeScene and loads clips', async () => {
		const { catalog, transport } = createTransportStub();
		const model = createSceneEditorPageModel({ transport });
		await model.loadScenes('story-1');

		await model.selectScene('scene-1');

		expect(model.activeSceneId).toBe('scene-1');
		expect(model.activeScene).not.toBeNull();
		expect(model.activeScene!.id).toBe('scene-1');
		expect(catalog.listClips).toHaveBeenCalledWith('scene-1');
		expect(model.clips).toHaveLength(2);
	});

	test('createScene() adds scene and refreshes', async () => {
		const { catalog, transport } = createTransportStub();
		const model = createSceneEditorPageModel({ transport });
		await model.loadScenes('story-1');

		await model.createScene({ storyId: 'story-1', orderIndex: 2, description: 'New' });

		expect(catalog.createScene).toHaveBeenCalled();
		expect(catalog.listScenes).toHaveBeenCalledTimes(2);
	});

	test('deleteScene() removes scene and clears selection if active', async () => {
		const { catalog, transport } = createTransportStub();
		const model = createSceneEditorPageModel({ transport });
		await model.loadScenes('story-1');
		await model.selectScene('scene-1');

		await model.deleteScene('scene-1');

		expect(catalog.deleteScene).toHaveBeenCalledWith('scene-1');
		expect(model.activeSceneId).toBeNull();
		expect(model.clips).toHaveLength(0);
	});

	test('createClip() adds clip and refreshes', async () => {
		const { catalog, transport } = createTransportStub();
		const model = createSceneEditorPageModel({ transport });
		await model.loadScenes('story-1');
		await model.selectScene('scene-1');

		await model.createClip({ sceneId: 'scene-1', orderIndex: 2, type: 'text' });

		expect(catalog.createClip).toHaveBeenCalled();
		expect(catalog.listClips).toHaveBeenCalledTimes(2);
	});

	test('deleteClip() removes clip and refreshes', async () => {
		const { catalog, transport } = createTransportStub();
		const model = createSceneEditorPageModel({ transport });
		await model.loadScenes('story-1');
		await model.selectScene('scene-1');

		await model.deleteClip('clip-1');

		expect(catalog.deleteClip).toHaveBeenCalledWith('clip-1');
	});

	test('loadScenes() error sets errorMessage', async () => {
		const { catalog, transport } = createTransportStub();
		catalog.listScenes.mockRejectedValueOnce(new Error('DB down'));
		const model = createSceneEditorPageModel({ transport });

		await model.loadScenes('story-1');

		expect(model.errorMessage).toBe('DB down');
		expect(model.isLoading).toBe(false);
	});
});
