import { describe, test, expect, mock } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { VibeVoiceOnnxNarrationGateway } from './VibeVoiceOnnxNarrationGateway.js';

const TEST_MODELS_DIR = join(tmpdir(), `vibevoice-test-${process.pid}`);
const TEST_MODEL_SLUG = 'microsoft--VibeVoice-1.5B';
const TEST_MODEL_PATH = join(TEST_MODELS_DIR, TEST_MODEL_SLUG);

function setupFakeModelDir() {
	mkdirSync(TEST_MODEL_PATH, { recursive: true });
	const fakeTokenizer = { model: { vocab: { h: 1, e: 2, l: 3, o: 4, ' ': 5, w: 6, r: 7, d: 8 } } };
	writeFileSync(join(TEST_MODEL_PATH, 'tokenizer.json'), JSON.stringify(fakeTokenizer));
	writeFileSync(join(TEST_MODEL_PATH, 'text_encoder.onnx'), '');
	writeFileSync(join(TEST_MODEL_PATH, 'acoustic_decoder.onnx'), '');
}

function cleanupFakeModelDir() {
	rmSync(TEST_MODELS_DIR, { recursive: true, force: true });
}

function createMockAssetStorage() {
	return {
		saveImage: mock(async () => ({ url: '/images/test.png', path: '/tmp/test.png' })),
		saveAudio: mock(async (_buf: Buffer, filename: string) => ({
			url: `/audio/${filename}`,
			path: `/tmp/${filename}`,
		})),
		listImages: mock(async () => []),
		listAudio: mock(async () => []),
		readFile: mock(async () => Buffer.from('')),
	};
}

function createMockOrt(audioData = new Float32Array(2400)) {
	const mockSession = {
		run: mock(async () => ({
			audio_output: { data: audioData, dims: [1, audioData.length] },
		})),
		release: mock(async () => {}),
	};

	return {
		InferenceSession: {
			create: mock(async () => mockSession),
		},
		Tensor: mock(function Tensor(_type: string, _data: unknown, _dims: number[]) {
			return { type: _type, data: _data, dims: _dims };
		} as unknown as { new (type: string, data: unknown, dims: number[]): unknown }),
		__mockSession: mockSession,
	};
}

describe('VibeVoiceOnnxNarrationGateway', () => {
	test('synthesizes audio, encodes WAV, stores via asset storage, and returns public URL', async () => {
		setupFakeModelDir();
		try {
			const storage = createMockAssetStorage();
			const ort = createMockOrt();

			const gateway = new VibeVoiceOnnxNarrationGateway({
				assetStorage: storage,
				modelsDir: TEST_MODELS_DIR,
				importOnnxRuntime: async () => ort as any,
			});

			const result = await gateway.synthesize(
				'Hello world',
				undefined,
				undefined,
				{ model: 'microsoft/VibeVoice-1.5B' },
			);

			expect(result.audioUrl).toContain('/audio/narration-vv-');
			expect(result.audioUrl).toEndWith('.wav');
			expect(result.durationMs).toBeGreaterThan(0);
			expect(storage.saveAudio).toHaveBeenCalledTimes(1);
			expect(ort.InferenceSession.create).toHaveBeenCalledTimes(1);
			expect(ort.__mockSession.release).toHaveBeenCalledTimes(1);
		} finally {
			cleanupFakeModelDir();
		}
	});

	test('rejects empty text with a clear error', async () => {
		const gateway = new VibeVoiceOnnxNarrationGateway({
			assetStorage: createMockAssetStorage(),
			modelsDir: '/fake/models',
			importOnnxRuntime: async () => createMockOrt() as any,
		});

		await expect(gateway.synthesize('  ', undefined, undefined, { model: 'microsoft/VibeVoice-1.5B' }))
			.rejects.toThrow('non-empty text');
	});

	test('rejects non-VibeVoice models', async () => {
		const gateway = new VibeVoiceOnnxNarrationGateway({
			assetStorage: createMockAssetStorage(),
			modelsDir: '/fake/models',
			importOnnxRuntime: async () => createMockOrt() as any,
		});

		await expect(gateway.synthesize('Test', undefined, undefined, { model: 'Xenova/mms-tts-eng' }))
			.rejects.toThrow('not a VibeVoice model');
	});

	test('throws if models directory is not configured', async () => {
		const gateway = new VibeVoiceOnnxNarrationGateway({
			assetStorage: createMockAssetStorage(),
			importOnnxRuntime: async () => createMockOrt() as any,
		});

		const originalEnv = process.env.VIBEVOICE_MODELS_DIR;
		delete process.env.VIBEVOICE_MODELS_DIR;
		try {
			await expect(gateway.synthesize('Test', undefined, undefined, { model: 'microsoft/VibeVoice-1.5B' }))
				.rejects.toThrow('models directory is not configured');
		} finally {
			if (originalEnv !== undefined) process.env.VIBEVOICE_MODELS_DIR = originalEnv;
		}
	});

	test('returns model list from catalog for vibevoice-local provider', () => {
		const gateway = new VibeVoiceOnnxNarrationGateway({
			assetStorage: createMockAssetStorage(),
			modelsDir: '/fake/models',
			importOnnxRuntime: async () => createMockOrt() as any,
		});

		const models = gateway.listModels();
		expect(models.length).toBeGreaterThan(0);
		expect(models.some((m) => m.value.includes('VibeVoice'))).toBe(true);
	});

	test('returns voice and language options for a VibeVoice model', () => {
		const gateway = new VibeVoiceOnnxNarrationGateway({
			assetStorage: createMockAssetStorage(),
			modelsDir: '/fake/models',
			importOnnxRuntime: async () => createMockOrt() as any,
		});

		const voices = gateway.listVoicesForModel('microsoft/VibeVoice-1.5B');
		expect(voices.length).toBeGreaterThan(0);

		const languages = gateway.listLanguagesForModel('microsoft/VibeVoice-1.5B');
		expect(languages.length).toBeGreaterThan(0);
	});

	test('isModelLocal returns false when model files do not exist', async () => {
		const gateway = new VibeVoiceOnnxNarrationGateway({
			assetStorage: createMockAssetStorage(),
			modelsDir: '/nonexistent/path',
			importOnnxRuntime: async () => createMockOrt() as any,
		});

		const result = await gateway.isModelLocal('microsoft/VibeVoice-1.5B');
		expect(result).toBe(false);
	});

	test('ensureModelReady throws when model not available locally', async () => {
		const gateway = new VibeVoiceOnnxNarrationGateway({
			assetStorage: createMockAssetStorage(),
			modelsDir: '/nonexistent/path',
			importOnnxRuntime: async () => createMockOrt() as any,
		});

		await expect(gateway.ensureModelReady('microsoft/VibeVoice-1.5B'))
			.rejects.toThrow('not available locally');
	});
});
