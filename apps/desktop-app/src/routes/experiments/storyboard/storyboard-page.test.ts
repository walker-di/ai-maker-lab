import { describe, expect, test } from 'vitest';
import { createStoryboardPageModel } from './storyboard-page.svelte';
import type { StoryboardDetail, StoryboardTransport } from '$lib/adapters/storyboard/StoryboardTransport';
import { StoryboardTransportError } from '$lib/adapters/storyboard/web-storyboard-transport';

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
		async batchGenerateAssets() { return detail; },
		async batchRegeneratePrompts() { return detail; },
		async duplicateFrame() { detail = { ...detail, frameCount: detail.frameCount + 1, frames: [...detail.frames, { ...detail.frames[0], id: 'frame-dup', orderIndex: detail.frames.length }] }; return detail; },
		async autoAssignTransitions() { detail = { ...detail, frames: detail.frames.map((f) => ({ ...f, transitionTypeAfter: 'fade' as const, transitionDurationMs: 500 })) }; return detail; },
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

	test('initial load failure sets initialLoadStatus to error and isBackendUnavailable', async () => {
		const failingTransport: StoryboardTransport = {
			...createTransport(),
			async listStoryboards() {
				throw new StoryboardTransportError({
					kind: 'backend-unavailable',
					userMessage: 'The storyboard service is temporarily unavailable.',
					status: 500,
					technicalMessage: '[DB] connect timed out after 30000ms',
				});
			},
		};
		const model = createStoryboardPageModel(failingTransport);
		await model.load();
		expect(model.initialLoadStatus).toBe('error');
		expect(model.isBackendUnavailable).toBe(true);
		expect(model.initialLoadError?.kind).toBe('backend-unavailable');
		expect(model.storyboards).toHaveLength(0);
	});

	test('operation error after load does not affect initialLoadStatus', async () => {
		const transport = createTransport();
		const model = createStoryboardPageModel(transport);
		await model.load();
		expect(model.initialLoadStatus).toBe('ready');

		// Force an operation error
		const orig = transport.createStoryboard.bind(transport);
		transport.createStoryboard = async () => { throw new Error('temporary write error'); };
		await model.create({ name: 'fail' });
		expect(model.initialLoadStatus).toBe('ready');
		expect(model.operationError).toBe('temporary write error');
		transport.createStoryboard = orig;
	});

	test('operation error includes technicalMessage from transport errors', async () => {
		const transport = createTransport();
		const model = createStoryboardPageModel(transport);
		await model.load();
		await model.open('story-1');

		transport.generateFrames = async () => {
			throw new StoryboardTransportError({
				kind: 'validation',
				userMessage: 'The request was invalid. Please check your input.',
				status: 400,
				technicalMessage: 'Validation failed: count: Expected number, received string',
			});
		};
		await model.generateFrames({ prompt: 'Test', count: 3 });
		expect(model.operationError).toContain('The request was invalid');
		expect(model.operationError).toContain('Validation failed: count');
	});

	test('operation error without technicalMessage shows only user message', async () => {
		const transport = createTransport();
		const model = createStoryboardPageModel(transport);
		await model.load();
		await model.open('story-1');

		transport.generateFrames = async () => {
			throw new StoryboardTransportError({
				kind: 'server',
				userMessage: 'An unexpected server error occurred.',
			});
		};
		await model.generateFrames({ prompt: 'Test', count: 3 });
		expect(model.operationError).toBe('An unexpected server error occurred.');
	});

	test('viewMode defaults to timeline', async () => {
		const model = createStoryboardPageModel(createTransport());
		expect(model.viewMode).toBe('timeline');
	});

	test('selectFrame and navigateFrame update selectedFrameIndex', async () => {
		const model = createStoryboardPageModel(createTransport());
		await model.open('story-1');
		await model.generateFrames({ prompt: 'Rocket', count: 1 });
		expect(model.selectedFrameIndex).toBe(0);
		model.selectFrame(0);
		expect(model.selectedFrameIndex).toBe(0);
	});

	test('duplicateFrame calls transport and updates detail', async () => {
		const model = createStoryboardPageModel(createTransport());
		await model.open('story-1');
		await model.generateFrames({ prompt: 'Rocket', count: 1 });
		await model.duplicateFrame('frame-1');
		expect(model.selected?.frames.length).toBe(2);
	});

	test('autoAssignTransitions updates all frames', async () => {
		const model = createStoryboardPageModel(createTransport());
		await model.open('story-1');
		await model.generateFrames({ prompt: 'Rocket', count: 1 });
		await model.autoAssignTransitions('uniform', 'fade', 500);
		expect(model.selected?.frames[0].transitionTypeAfter).toBe('fade');
		expect(model.selected?.frames[0].transitionDurationMs).toBe(500);
	});
});
