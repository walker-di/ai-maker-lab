import { describe, expect, test } from 'vitest';
import { createStoryboardPageModel } from './storyboard-page.svelte';
import type { StoryboardDetail, StoryboardTransport } from '$lib/adapters/storyboard/StoryboardTransport';

function createTransport(): StoryboardTransport {
	let detail: StoryboardDetail = {
		id: 'story-1',
		name: 'Launch',
		frameCount: 0,
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z',
		frames: [],
	};
	return {
		async listStoryboards() { return [{ id: detail.id, name: detail.name, frameCount: detail.frameCount, createdAt: detail.createdAt, updatedAt: detail.updatedAt }]; },
		async getStoryboard() { return detail; },
		async createStoryboard(input) { detail = { ...detail, name: input.name }; return { id: detail.id, name: detail.name, frameCount: detail.frameCount, createdAt: detail.createdAt, updatedAt: detail.updatedAt }; },
		async generateFrames() { detail = { ...detail, frameCount: 1, frames: [{ id: 'frame-1', storyboardId: detail.id, sceneId: 'frame-1', orderIndex: 0, narration: 'n', mainImagePrompt: 'm', backgroundImagePrompt: 'b', bgmPrompt: 'music', transitionTypeAfter: 'none', transitionDurationMs: 1000, createdAt: detail.createdAt, updatedAt: detail.updatedAt }] }; return detail; },
		async insertBlankFrame() { return detail; },
		async updateFrameText() { return detail.frames[0]; },
		async deleteFrame() { detail = { ...detail, frames: [], frameCount: 0 }; return detail; },
		async reorderFrame() { return detail; },
		async regeneratePrompt() { return { prompt: 'new', frame: detail.frames[0] }; },
		async generateFrameAsset() { return detail.frames[0]; },
		async attachFrameAsset() { return detail.frames[0]; },
		async updateTransition() { return detail.frames[0]; },
		async exportUnifiedVideo() { return { videoPath: '/x.mp4', durationMs: 1000 }; },
	};
}

describe('storyboard page model', () => {
	test('loads, creates, and opens a storyboard via transport', async () => {
		const model = createStoryboardPageModel(createTransport());
		await model.load();
		expect(model.storyboards).toHaveLength(1);
		await model.create({ name: 'New launch' });
		expect(model.selected?.name).toBe('New launch');
	});

	test('generates frames and exports through the transport', async () => {
		const model = createStoryboardPageModel(createTransport());
		await model.open('story-1');
		await model.generateFrames({ prompt: 'Rocket', count: 1 });
		expect(model.selected?.frames).toHaveLength(1);
		await model.exportVideo();
		expect(model.exportStatus).toBe('done');
		expect(model.exportUrl).toBe('/x.mp4');
	});
});
