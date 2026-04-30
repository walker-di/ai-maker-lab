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
		async getNarrationOptions(input) {
			const provider = input.provider;
			const selectedModel = input.model;
			const isHfMms = provider === 'huggingface-local' && selectedModel === 'Xenova/mms-tts-eng';
			return {
				provider,
				supportsLocalModelDownload: provider === 'huggingface-local',
				models: provider === 'huggingface-local'
					? [{ value: 'Xenova/mms-tts-eng', label: 'MMS TTS English' }]
					: [{ value: 'azure-neural', label: 'Azure Neural Voices (managed)' }],
				voices: isHfMms ? [{ value: 'default', label: 'Default voice' }] : [],
				languages: isHfMms
					? [{ value: 'en', label: 'English' }]
					: [{ value: 'en-US', label: 'English (US)' }],
			};
		},
		async getNarrationModelStatus(input) {
			return {
				provider: input.provider,
				model: input.model,
				local: false,
				supportsLocalModelDownload: input.provider === 'huggingface-local',
			};
		},
		async downloadNarrationModel(input) {
			return { provider: input.provider, model: input.model, local: true };
		},
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
		const created = await model.create({ name: 'fail' });
		expect(created).toBe(false);
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

	test('openCreateDialog opens dialog state', async () => {
		const model = createStoryboardPageModel(createTransport());
		expect(model.createDialogOpen).toBe(false);
		model.openCreateDialog();
		expect(model.createDialogOpen).toBe(true);
	});

	test('openCreateDialog surfaces backend unavailable as operation error', async () => {
		const failingTransport: StoryboardTransport = {
			...createTransport(),
			async listStoryboards() {
				throw new StoryboardTransportError({
					kind: 'backend-unavailable',
					userMessage: 'The storyboard service is temporarily unavailable.',
				});
			},
		};
		const model = createStoryboardPageModel(failingTransport);
		await model.load();
		model.openCreateDialog();
		expect(model.createDialogOpen).toBe(false);
		expect(model.operationError).toContain('temporarily unavailable');
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

	test('passes audio model config when generating narration assets', async () => {
		const transport = createTransport();
		const generateFrameAssetCalls: unknown[] = [];
		transport.generateFrameAsset = async (_storyboardId, _frameId, _assetType, modelConfig) => {
			generateFrameAssetCalls.push(modelConfig);
			return transport.getStoryboard('story-1').then((storyboard) => storyboard.frames[0]);
		};
		const model = createStoryboardPageModel(transport);
		await model.open('story-1');
		await model.generateFrames({ prompt: 'Rocket', count: 1 });
		model.modelConfig = {
			...model.modelConfig,
			audioProvider: 'huggingface-local',
			audioModel: 'onnx-community/Kokoro-82M-v1.0-ONNX',
			audioVoice: 'af_heart',
			audioLanguage: 'en',
		};

		await model.generateAsset('frame-1', 'narrationAudio');

		expect(generateFrameAssetCalls[0]).toMatchObject({
			audioProvider: 'huggingface-local',
			audioModel: 'onnx-community/Kokoro-82M-v1.0-ONNX',
			audioVoice: 'af_heart',
			audioLanguage: 'en',
		});
	});

	test('autoAssignTransitions updates all frames', async () => {
		const model = createStoryboardPageModel(createTransport());
		await model.open('story-1');
		await model.generateFrames({ prompt: 'Rocket', count: 1 });
		await model.autoAssignTransitions('uniform', 'fade', 500);
		expect(model.selected?.frames[0].transitionTypeAfter).toBe('fade');
		expect(model.selected?.frames[0].transitionDurationMs).toBe(500);
	});

	test('loads provider-specific narration options', async () => {
		const model = createStoryboardPageModel(createTransport());
		await model.setAudioProvider('huggingface-local');
		expect(model.narrationOptions.provider).toBe('huggingface-local');
		expect(model.narrationOptions.models[0]?.value).toBe('Xenova/mms-tts-eng');
	});

	test('requests model-aware narration options after audio model selection', async () => {
		const transport = createTransport();
		const optionCalls: Array<{ provider: string; model?: string }> = [];
		const originalGetNarrationOptions = transport.getNarrationOptions.bind(transport);
		transport.getNarrationOptions = async (input) => {
			optionCalls.push(input);
			return originalGetNarrationOptions(input);
		};
		const model = createStoryboardPageModel(transport);

		await model.setAudioProvider('huggingface-local');
		await model.setAudioModel('Xenova/mms-tts-eng');

		expect(optionCalls.some((call) => call.provider === 'huggingface-local' && call.model === 'Xenova/mms-tts-eng')).toBe(true);
		expect(model.narrationOptions.voices[0]?.value).toBe('default');
		expect(model.narrationOptions.languages[0]?.value).toBe('en');
	});

	test('preserves manual voice and language when options are empty', async () => {
		const transport = createTransport();
		transport.getNarrationOptions = async (input) => ({
			provider: input.provider,
			supportsLocalModelDownload: true,
			models: [{ value: 'Xenova/mms-tts-eng', label: 'MMS TTS English' }],
			voices: [],
			languages: [],
		});
		const model = createStoryboardPageModel(transport);
		model.modelConfig = {
			...model.modelConfig,
			audioVoice: 'my-custom-voice',
			audioLanguage: 'custom-locale',
		};

		await model.setAudioProvider('huggingface-local');

		expect(model.modelConfig.audioVoice).toBe('my-custom-voice');
		expect(model.modelConfig.audioLanguage).toBe('custom-locale');
	});

	test('downloads narration model and marks status ready', async () => {
		const model = createStoryboardPageModel(createTransport());
		await model.setAudioProvider('huggingface-local');
		model.modelConfig = { ...model.modelConfig, audioModel: 'onnx-community/Kokoro-82M-v1.0-ONNX' };
		await model.downloadNarrationModel();
		expect(model.narrationModelStatus).toBe('ready');
	});

	test('huggingface options expose only supported local narration models', async () => {
		const model = createStoryboardPageModel(createTransport());
		await model.setAudioProvider('huggingface-local');
		expect(model.narrationOptions.models.some((m) => m.value === 'Xenova/mms-tts-eng')).toBe(true);
		expect(model.narrationOptions.models.some((m) => m.value.toLowerCase().includes('vibevoice'))).toBe(false);
	});
});
