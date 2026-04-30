import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { LocalMarketingAssetStorage } from 'domain/infrastructure';
import {
	HuggingFaceTransformersNarrationGateway,
	encodePcm16Wav,
} from './HuggingFaceTransformersNarrationGateway.js';

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(path.join(os.tmpdir(), 'hf-narration-'));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe('HuggingFaceTransformersNarrationGateway', () => {
	test('lazy loads Transformers, encodes WAV, stores audio, and returns a public URL', async () => {
		let importCount = 0;
		const calls: Array<{ task: string; model: string; text: string; options?: Record<string, unknown> }> = [];
		const gateway = new HuggingFaceTransformersNarrationGateway({
			assetStorage: new LocalMarketingAssetStorage({ assetRoot: tempDir, publicBaseUrl: '/marketing-assets' }),
			model: 'Xenova/mms-tts-eng',
			language: 'en-US',
			importTransformers: async () => {
				importCount += 1;
				return {
					pipeline: async (task, model) => async (text, options) => {
						calls.push({ task, model, text, options });
						return { audio: new Float32Array([0, 0.5, -0.5, 1]), sampling_rate: 16000 };
					},
				};
			},
		});

		expect(importCount).toBe(0);

		const result = await gateway.synthesize('Hello storyboard', undefined, 'fr-FR');

		expect(importCount).toBe(1);
		expect(calls).toEqual([
			{
				task: 'text-to-speech',
				model: 'Xenova/mms-tts-eng',
				text: 'Hello storyboard',
				options: { language: 'fr-FR' },
			},
		]);
		expect(result.audioUrl).toStartWith('/marketing-assets/audio/narration-hf-');
		expect(result.audioUrl).toEndWith('.wav');
		expect(result.durationMs).toBe(0);

		const filename = path.basename(result.audioUrl);
		const stored = await readFile(path.join(tempDir, 'audio', filename));
		expect(stored.subarray(0, 4).toString()).toBe('RIFF');
		expect(stored.subarray(8, 12).toString()).toBe('WAVE');
	});

	test('rejects malformed Transformers output with a clear provider error', async () => {
		const gateway = new HuggingFaceTransformersNarrationGateway({
			assetStorage: new LocalMarketingAssetStorage({ assetRoot: tempDir, publicBaseUrl: '/marketing-assets' }),
			importTransformers: async () => ({
				pipeline: async () => async () => ({ audio: 'not audio', sampling_rate: 16000 }),
			}),
		});

		await expect(gateway.synthesize('Hello', 'voice')).rejects.toThrow(
			'Hugging Face narration failed: Transformers TTS returned invalid audio',
		);
	});

	test('returns model-aware fallback voice and language options', () => {
		const gateway = new HuggingFaceTransformersNarrationGateway({
			assetStorage: new LocalMarketingAssetStorage({ assetRoot: tempDir, publicBaseUrl: '/marketing-assets' }),
		});

		expect(gateway.listModels()).toEqual([
			{ value: 'Xenova/mms-tts-eng', label: 'MMS TTS English' },
		]);
		expect(gateway.listVoicesForModel('Xenova/mms-tts-eng')).toEqual([
			{ value: 'default', label: 'Default voice (model-managed)' },
		]);
		expect(gateway.listLanguagesForModel('Xenova/mms-tts-eng')).toEqual([
			{ value: 'en-US', label: 'English (US)' },
		]);
	});

	test('rejects unsupported VibeVoice models with an actionable message', async () => {
		const gateway = new HuggingFaceTransformersNarrationGateway({
			assetStorage: new LocalMarketingAssetStorage({ assetRoot: tempDir, publicBaseUrl: '/marketing-assets' }),
			model: 'microsoft/VibeVoice-1.5B',
			importTransformers: async () => ({
				pipeline: async () => async () => ({ audio: new Float32Array([0.1]), sampling_rate: 16000 }),
			}),
		});

		await expect(gateway.synthesize('Hello')).rejects.toThrow(
			'VibeVoice models are not supported by @huggingface/transformers in this app yet',
		);
	});
});

describe('encodePcm16Wav', () => {
	test('writes a mono PCM WAV header', () => {
		const wav = encodePcm16Wav([0, 1, -1], 24000);

		expect(wav.subarray(0, 4).toString()).toBe('RIFF');
		expect(wav.subarray(8, 12).toString()).toBe('WAVE');
		expect(wav.readUInt16LE(20)).toBe(1);
		expect(wav.readUInt16LE(22)).toBe(1);
		expect(wav.readUInt32LE(24)).toBe(24000);
		expect(wav.readUInt16LE(34)).toBe(16);
		expect(wav.readUInt32LE(40)).toBe(6);
	});
});
