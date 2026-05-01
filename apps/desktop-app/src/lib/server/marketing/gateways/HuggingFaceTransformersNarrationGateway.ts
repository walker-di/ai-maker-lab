import type { Marketing } from 'domain/application';
import { AiModels } from 'domain/shared';

type TextToSpeechPipeline = (
	text: string,
	options?: Record<string, unknown>,
) => Promise<unknown> | unknown;

type TransformersPipelineOptions = {
	local_files_only?: boolean;
};

type TransformersModule = {
	pipeline: (
		task: string,
		model: string,
		options?: TransformersPipelineOptions,
	) => Promise<TextToSpeechPipeline> | TextToSpeechPipeline;
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

const DEFAULT_TTS_MODEL = 'Xenova/mms-tts-eng';
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
			const requestedModel = options?.model || this.config.model || process.env.MARKETING_HF_TTS_MODEL || DEFAULT_TTS_MODEL;
			const model = requestedModel.trim();
			assertSupportedNarrationModel(model);
			const pipeline = await this.getPipeline(model);
			const selectedLanguage = lang || this.config.language || process.env.MARKETING_HF_TTS_LANGUAGE;
			const pipelineOptions: Record<string, unknown> = {};
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
		return [];
	}

	listModels(): Array<{ value: string; label: string }> {
		return AiModels.listNarrationModelCards('huggingface-local').map((model) => ({
			value: model.value,
			label: model.label,
		}));
	}

	listVoicesForModel(model?: string): Array<{ value: string; label: string }> {
		const metadata = resolveNarrationModelMetadata(model ?? this.config.model ?? process.env.MARKETING_HF_TTS_MODEL);
		return metadata.voices.map((voice) => ({ value: voice.value, label: voice.label }));
	}

	listLanguagesForModel(model?: string): Array<{ value: string; label: string }> {
		const metadata = resolveNarrationModelMetadata(model ?? this.config.model ?? process.env.MARKETING_HF_TTS_MODEL);
		return metadata.languages.map((language) => ({ value: language.value, label: language.label }));
	}

	listLanguages(model?: string): Array<{ value: string; label: string }> {
		return this.listLanguagesForModel(model);
	}

	async isModelLocal(model: string): Promise<boolean> {
		if (!model.trim()) return false;
		assertSupportedNarrationModel(model);
		const task = this.config.task || DEFAULT_TTS_TASK;
		try {
			const module = await this.importTransformers();
			await module.pipeline(task, model, { local_files_only: true });
			return true;
		} catch {
			return false;
		}
	}

	async ensureModelReady(model: string): Promise<void> {
		if (!model.trim()) throw new Error('Model is required to download local narration weights.');
		assertSupportedNarrationModel(model);
		await this.getPipeline(model);
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

function resolveNarrationModelMetadata(model?: string): AiModels.NarrationModelCard {
	const selectedModel = (model ?? '').trim() || DEFAULT_TTS_MODEL;
	assertSupportedNarrationModel(selectedModel);
	const knownModel = AiModels.findNarrationModelCardForProvider('huggingface-local', selectedModel);
	if (knownModel) return knownModel;
	return {
		provider: 'huggingface-local',
		value: selectedModel,
		label: selectedModel,
		availability: 'available',
		status: 'available',
		badges: ['local'],
		voices: [{ value: 'default', label: 'Default voice (model-managed)', stability: 'stable' }],
		languages: [{ value: 'en-US', label: 'English (US)', stability: 'stable' }],
	};
}

function assertSupportedNarrationModel(model: string): void {
	const selectedModel = model.trim();
	if (!selectedModel) {
		throw new Error('Model is required for Hugging Face local narration.');
	}
	const matchedModelCard = AiModels.findNarrationModelCard(selectedModel);
	if (matchedModelCard?.provider === 'vibevoice-local' || /vibevoice/i.test(selectedModel)) {
		throw new Error('VibeVoice models are not supported by @huggingface/transformers in this app yet.');
	}
	if (/kokoro|speecht5/i.test(selectedModel)) {
		throw new Error('This model is not supported by the installed @huggingface/transformers runtime. Use Xenova/mms-tts-eng.');
	}
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
