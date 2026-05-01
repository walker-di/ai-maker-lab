import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { LocalMarketingAssetStorage } from 'domain/infrastructure';
import {
	CompositeNarrationAudioGateway,
	createNarrationAudioGateway,
	toMarketingErrorResponse,
} from './marketing-service.js';
import { Marketing } from 'domain/shared';
import type { Marketing as MarketingApplication } from 'domain/application';

let tempDir: string;
const originalEnv = { ...process.env };

beforeEach(async () => {
	tempDir = await mkdtemp(path.join(os.tmpdir(), 'marketing-service-'));
	process.env = { ...originalEnv };
});

afterEach(async () => {
	process.env = { ...originalEnv };
	await rm(tempDir, { recursive: true, force: true });
});

function testAssetStorage() {
	return new LocalMarketingAssetStorage({ assetRoot: tempDir, publicBaseUrl: '/marketing-assets' });
}

class RecordingNarrationGateway implements MarketingApplication.INarrationAudioGateway {
	readonly calls: Array<{ text: string; voice?: string; lang?: string; options?: { provider?: string; model?: string } }> = [];

	constructor(private readonly id: string) {}

	async synthesize(
		text: string,
		voice?: string,
		lang?: string,
		options?: { provider?: string; model?: string },
	): Promise<{ audioUrl: string; durationMs: number }> {
		this.calls.push({ text, voice, lang, options });
		return { audioUrl: `/marketing-assets/audio/${this.id}.wav`, durationMs: 123 };
	}

	async listVoices(): Promise<{ id: string; name: string; lang: string; gender: string }[]> {
		return [{ id: this.id, name: this.id, lang: 'en-US', gender: 'unknown' }];
	}
}

class RecordingLocalModelNarrationGateway extends RecordingNarrationGateway {
	listModels() {
		return [{ value: 'Xenova/mms-tts-eng', label: 'MMS TTS English (HF local)' }];
	}

	listVoicesForModel(model?: string) {
		if (model === 'Xenova/mms-tts-eng') {
			return [{ value: 'default', label: 'Default voice (model-managed)' }];
		}
		return [{ value: 'default', label: 'Default voice' }];
	}

	listLanguagesForModel(model?: string) {
		if (model === 'Xenova/mms-tts-eng') {
			return [{ value: 'en-US', label: 'English (US)' }];
		}
		return [{ value: 'en-US', label: 'English (US)' }];
	}

	async isModelLocal(): Promise<boolean> {
		return true;
	}

	async ensureModelReady(): Promise<void> {
		return;
	}
}

describe('createNarrationAudioGateway', () => {
	test('defaults to Azure narration voices', async () => {
		const gateway = createNarrationAudioGateway({
			assetStorage: testAssetStorage(),
			azure: { apiKey: 'key', region: 'eastus', voice: 'en-US-JennyNeural' },
		});

		await expect(gateway.listVoices()).resolves.toContainEqual({
			id: 'en-US-JennyNeural',
			name: 'Jenny',
			lang: 'en-US',
			gender: 'female',
		});
	});

	test('uses Hugging Face local provider with no fixed voice list by default', async () => {
		process.env.MARKETING_HF_TTS_VOICE = 'mock-hf-voice';
		process.env.MARKETING_HF_TTS_LANGUAGE = 'en-US';
		const gateway = createNarrationAudioGateway({
			provider: 'huggingface-local',
			assetStorage: testAssetStorage(),
			azure: { apiKey: 'key', region: 'eastus', voice: 'en-US-JennyNeural' },
		});

		await expect(gateway.listVoices()).resolves.toEqual([]);
	});

	test('returns model-aware Hugging Face options with non-empty fallback voice', async () => {
		const azure = new RecordingNarrationGateway('azure');
		const huggingFace = new RecordingLocalModelNarrationGateway('huggingface-local');
		const vibevoice = new RecordingNarrationGateway('vibevoice-local');
		const gateway = new CompositeNarrationAudioGateway('azure', {
			azure,
			'huggingface-local': huggingFace,
			'vibevoice-local': vibevoice,
		});

		await expect(gateway.getOptions('huggingface-local', 'Xenova/mms-tts-eng')).resolves.toMatchObject({
			provider: 'huggingface-local',
			supportsLocalModelDownload: true,
			models: [{ value: 'Xenova/mms-tts-eng', label: 'MMS TTS English (HF local)', availability: 'available' }],
			voices: [{ value: 'default', label: 'Default voice (model-managed)', stability: 'stable' }],
			languages: [{ value: 'en-US', label: 'English (US)', stability: 'stable' }],
		});
	});

	test('returns blocked/missing metadata for vibevoice model cards', async () => {
		const azure = new RecordingNarrationGateway('azure');
		const huggingFace = new RecordingLocalModelNarrationGateway('huggingface-local');
		const vibevoice = new RecordingNarrationGateway('vibevoice-local');
		const gateway = new CompositeNarrationAudioGateway('azure', {
			azure,
			'huggingface-local': huggingFace,
			'vibevoice-local': vibevoice,
		});

		const options = await gateway.getOptions('vibevoice-local', 'microsoft/VibeVoice-Realtime-0.5B');
		expect(options.supportsLocalModelDownload).toBe(false);
		expect(options.models).toEqual(expect.arrayContaining([
			expect.objectContaining({
				value: 'microsoft/VibeVoice-1.5B',
				availability: 'blocked',
			}),
			expect.objectContaining({
				value: 'microsoft/VibeVoice-Realtime-0.5B',
				availability: 'missing',
				status: 'experimental',
			}),
		]));
		expect(options.languages).toContainEqual(expect.objectContaining({ value: 'en-US', stability: 'stable' }));
		expect(options.languages).toContainEqual(expect.objectContaining({ value: 'es-ES', stability: 'experimental' }));
		expect(options.downloadSupportMessage).toContain('Realtime local runtime is not configured');
	});

	test('returns vibevoice model status metadata without pretending local availability', async () => {
		const azure = new RecordingNarrationGateway('azure');
		const huggingFace = new RecordingLocalModelNarrationGateway('huggingface-local');
		const vibevoice = new RecordingNarrationGateway('vibevoice-local');
		const gateway = new CompositeNarrationAudioGateway('azure', {
			azure,
			'huggingface-local': huggingFace,
			'vibevoice-local': vibevoice,
		});

		await expect(gateway.getModelStatus('vibevoice-local', 'microsoft/VibeVoice-1.5B')).resolves.toMatchObject({
			local: false,
			supportsLocalModelDownload: false,
			availability: 'blocked',
			status: 'blocked',
		});
	});

	test('rejects vibevoice local model download with explicit reason', async () => {
		const azure = new RecordingNarrationGateway('azure');
		const huggingFace = new RecordingLocalModelNarrationGateway('huggingface-local');
		const vibevoice = new RecordingNarrationGateway('vibevoice-local');
		const gateway = new CompositeNarrationAudioGateway('azure', {
			azure,
			'huggingface-local': huggingFace,
			'vibevoice-local': vibevoice,
		});

		await expect(gateway.downloadModel('vibevoice-local', 'microsoft/VibeVoice-1.5B')).rejects.toThrow(
			'Official local usage is disabled upstream for this runtime.',
		);
	});

	test('dispatches per-request provider while keeping Azure as fallback default', async () => {
		const azure = new RecordingNarrationGateway('azure');
		const huggingFace = new RecordingNarrationGateway('huggingface-local');
		const vibevoice = new RecordingNarrationGateway('vibevoice-local');
		const gateway = new CompositeNarrationAudioGateway('azure', {
			azure,
			'huggingface-local': huggingFace,
			'vibevoice-local': vibevoice,
		});

		await expect(gateway.synthesize('hello', 'voice', 'en-US', {
			provider: 'huggingface-local',
			model: 'mock/model',
		})).resolves.toEqual({ audioUrl: '/marketing-assets/audio/huggingface-local.wav', durationMs: 123 });
		await gateway.synthesize('default narration');

		expect(huggingFace.calls).toEqual([
			{
				text: 'hello',
				voice: 'voice',
				lang: 'en-US',
				options: { provider: 'huggingface-local', model: 'mock/model' },
			},
		]);
		expect(azure.calls).toEqual([
			{ text: 'default narration', voice: undefined, lang: undefined, options: undefined },
		]);
		expect(vibevoice.calls).toEqual([]);
	});

	test('dispatches vibevoice-local requests to vibevoice gateway', async () => {
		const azure = new RecordingNarrationGateway('azure');
		const huggingFace = new RecordingNarrationGateway('huggingface-local');
		const vibevoice = new RecordingNarrationGateway('vibevoice-local');
		const gateway = new CompositeNarrationAudioGateway('azure', {
			azure,
			'huggingface-local': huggingFace,
			'vibevoice-local': vibevoice,
		});

		await gateway.synthesize('hello', 'voice', 'en-US', { provider: 'vibevoice-local', model: 'microsoft/VibeVoice-1.5B' });

		expect(huggingFace.calls).toHaveLength(0);
		expect(vibevoice.calls).toHaveLength(1);
		expect(azure.calls).toHaveLength(0);
	});
});

describe('toMarketingErrorResponse', () => {
	test('maps provider response_format schema errors to 502', async () => {
		const response = toMarketingErrorResponse(
			new Error("Invalid schema for response_format: Missing 'title'"),
		);

		expect(response.status).toBe(502);
		await expect(response.json()).resolves.toMatchObject({
			error: "Invalid schema for response_format: Missing 'title'",
		});
	});

	test('maps AI generation failures to 502', async () => {
		const response = toMarketingErrorResponse(
			new Error('No object generated: output did not match the schema'),
		);
		expect(response.status).toBe(502);
	});

	test('maps OpenAI quota errors (with issues array) to 502', async () => {
		const quotaError = Object.assign(new Error('API error'), {
			issues: [
				{ message: 'You exceeded your current quota, please check your plan and billing details.' },
				{ message: 'You exceeded your current quota, please check your plan and billing details.' },
			],
		});

		const response = toMarketingErrorResponse(quotaError);

		expect(response.status).toBe(502);
		const body = await response.json() as { error: string };
		expect(body.error).toBe('API error');
	});

	test('maps real Zod v4 validation errors to 400', async () => {
		let zodError: unknown;
		try {
			Marketing.CreateProductDtoSchema.parse({ name: '' });
		} catch (e) {
			zodError = e;
		}

		const response = toMarketingErrorResponse(zodError);

		expect(response.status).toBe(400);
		const body = await response.json() as { error: string };
		expect(body.error).toStartWith('Validation failed:');
		expect(body.error).toContain('name');
	});

	test('does not crash on issues array without path (non-Zod errors)', async () => {
		const weirdError = Object.assign(new Error('Something went wrong'), {
			issues: [{ code: 'custom', message: 'something failed' }],
		});

		const response = toMarketingErrorResponse(weirdError);

		expect(response.status).toBe(500);
		const body = await response.json() as { error: string };
		expect(body.error).toBe('Something went wrong');
	});
});
