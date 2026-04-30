import type { Marketing } from 'domain/application';

type TextToSpeechPipeline = (
	text: string,
	options?: Record<string, unknown>,
) => Promise<unknown> | unknown;

type TransformersModule = {
	pipeline: (task: string, model: string) => Promise<TextToSpeechPipeline> | TextToSpeechPipeline;
};

export interface HuggingFaceTransformersNarrationGatewayConfig {
	assetStorage: Marketing.IMarketingAssetStorage;
	model?: string;
	voice?: string;
	language?: string;
	task?: string;
	importTransformers?: () => Promise<TransformersModule>;
}

interface NormalizedAudioOutput {
	audio: Float32Array | number[];
	sampleRate: number;
}

const DEFAULT_TTS_MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const DEFAULT_TTS_VOICE = 'af_heart';
const DEFAULT_TTS_TASK = 'text-to-speech';

export class HuggingFaceTransformersNarrationGateway implements Marketing.INarrationAudioGateway {
	private readonly pipelinePromises = new Map<string, Promise<TextToSpeechPipeline>>();

	constructor(private readonly config: HuggingFaceTransformersNarrationGatewayConfig) {}

	async synthesize(
		text: string,
		voice?: string,
		lang?: string,
		options?: { provider?: string; model?: string },
	): Promise<{ audioUrl: string; durationMs: number }> {
		if (!text.trim()) throw new Error('Hugging Face narration requires non-empty text.');

		try {
			const model = options?.model || this.config.model || process.env.MARKETING_HF_TTS_MODEL || DEFAULT_TTS_MODEL;
			const pipeline = await this.getPipeline(model);
			const selectedVoice = voice || this.config.voice || process.env.MARKETING_HF_TTS_VOICE || DEFAULT_TTS_VOICE;
			const selectedLanguage = lang || this.config.language || process.env.MARKETING_HF_TTS_LANGUAGE;
			const pipelineOptions: Record<string, unknown> = {};
			if (selectedVoice) pipelineOptions.voice = selectedVoice;
			if (selectedLanguage) pipelineOptions.language = selectedLanguage;

			const rawOutput = await pipeline(text, Object.keys(pipelineOptions).length ? pipelineOptions : undefined);
			const output = normalizeAudioOutput(rawOutput);
			const wav = encodePcm16Wav(output.audio, output.sampleRate);
			const durationMs = Math.round((output.audio.length / output.sampleRate) * 1000);
			const filename = `narration-hf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.wav`;
			const saved = await this.config.assetStorage.saveAudio(wav, filename);
			return { audioUrl: saved.url, durationMs };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(`Hugging Face narration failed: ${message}`, { cause: error });
		}
	}

	async listVoices(): Promise<{ id: string; name: string; lang: string; gender: string }[]> {
		const voice = this.config.voice || process.env.MARKETING_HF_TTS_VOICE || DEFAULT_TTS_VOICE;
		const lang = this.config.language || process.env.MARKETING_HF_TTS_LANGUAGE || 'en-US';
		return [{ id: voice, name: voice, lang, gender: 'unknown' }];
	}

	private async getPipeline(model: string): Promise<TextToSpeechPipeline> {
		const task = this.config.task || DEFAULT_TTS_TASK;
		const cacheKey = `${task}:${model}`;
		let pipelinePromise = this.pipelinePromises.get(cacheKey);
		if (!pipelinePromise) {
			pipelinePromise = (async () => {
				const module = await this.importTransformers();
				return module.pipeline(task, model);
			})();
			this.pipelinePromises.set(cacheKey, pipelinePromise);
		}
		return pipelinePromise;
	}

	private async importTransformers(): Promise<TransformersModule> {
		if (this.config.importTransformers) return this.config.importTransformers();
		return (await import('@huggingface/transformers')) as TransformersModule;
	}
}

function normalizeAudioOutput(rawOutput: unknown): NormalizedAudioOutput {
	const output = Array.isArray(rawOutput) ? rawOutput[0] : rawOutput;
	if (!isRecord(output)) {
		throw new Error('Transformers TTS returned an unsupported output shape. Expected an object with audio and sampling_rate.');
	}

	const audio = output.audio;
	if (!(audio instanceof Float32Array) && !isNumberArray(audio)) {
		throw new Error('Transformers TTS returned invalid audio. Expected Float32Array or number[].');
	}

	const sampleRate = output.sampling_rate ?? output.samplingRate;
	if (typeof sampleRate !== 'number' || !Number.isFinite(sampleRate) || sampleRate <= 0) {
		throw new Error('Transformers TTS returned invalid sampling rate. Expected sampling_rate or samplingRate number.');
	}

	return { audio, sampleRate };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function isNumberArray(value: unknown): value is number[] {
	return Array.isArray(value) && value.every((sample) => typeof sample === 'number' && Number.isFinite(sample));
}

export function encodePcm16Wav(samples: Float32Array | number[], sampleRate: number): Buffer {
	const dataSize = samples.length * 2;
	const buffer = Buffer.alloc(44 + dataSize);

	buffer.write('RIFF', 0);
	buffer.writeUInt32LE(36 + dataSize, 4);
	buffer.write('WAVE', 8);
	buffer.write('fmt ', 12);
	buffer.writeUInt32LE(16, 16);
	buffer.writeUInt16LE(1, 20);
	buffer.writeUInt16LE(1, 22);
	buffer.writeUInt32LE(sampleRate, 24);
	buffer.writeUInt32LE(sampleRate * 2, 28);
	buffer.writeUInt16LE(2, 32);
	buffer.writeUInt16LE(16, 34);
	buffer.write('data', 36);
	buffer.writeUInt32LE(dataSize, 40);

	for (let i = 0; i < samples.length; i += 1) {
		const clamped = Math.max(-1, Math.min(1, samples[i]));
		const int16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
		buffer.writeInt16LE(Math.round(int16), 44 + i * 2);
	}

	return buffer;
}
