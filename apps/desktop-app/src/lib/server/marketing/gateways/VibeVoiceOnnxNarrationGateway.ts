import type { Marketing } from 'domain/application';
import { AiModels } from 'domain/shared';
import { encodePcm16Wav } from './HuggingFaceTransformersNarrationGateway.js';

type OrtInferenceSession = {
	run(feeds: Record<string, unknown>): Promise<Record<string, { data: Float32Array; dims: number[] }>>;
	release(): Promise<void>;
};

type OrtTensor = {
	new (type: string, data: unknown, dims: number[]): unknown;
};

type OnnxRuntimeModule = {
	InferenceSession: {
		create(path: string, options?: Record<string, unknown>): Promise<OrtInferenceSession>;
	};
	Tensor: OrtTensor;
};

export interface VibeVoiceOnnxNarrationGatewayConfig {
	assetStorage: Marketing.IMarketingAssetStorage;
	modelsDir?: string;
	importOnnxRuntime?: () => Promise<OnnxRuntimeModule>;
}

interface VibeVoiceModelManifest {
	textEncoder: string;
	lmPrefill: string;
	lmStep: string;
	acousticDecoder: string;
	tokenizer: string;
	sampleRate: number;
}

const DEFAULT_VIBEVOICE_MODEL = 'microsoft/VibeVoice-1.5B';
const DEFAULT_SAMPLE_RATE = 24_000;

const MANIFEST_DEFAULTS: VibeVoiceModelManifest = {
	textEncoder: 'text_encoder.onnx',
	lmPrefill: 'tts_lm_prefill.onnx',
	lmStep: 'tts_lm_step.onnx',
	acousticDecoder: 'acoustic_decoder.onnx',
	tokenizer: 'tokenizer.json',
	sampleRate: DEFAULT_SAMPLE_RATE,
};

export class VibeVoiceOnnxNarrationGateway implements Marketing.INarrationAudioGateway {
	constructor(private readonly config: VibeVoiceOnnxNarrationGatewayConfig) {}

	async synthesize(
		text: string,
		_voice?: string,
		_lang?: string,
		options?: { provider?: string; model?: string },
	): Promise<{ audioUrl: string; durationMs: number }> {
		if (!text.trim()) throw new Error('VibeVoice narration requires non-empty text.');

		const model = options?.model || DEFAULT_VIBEVOICE_MODEL;
		assertVibeVoiceModel(model);

		const modelsDir = this.resolveModelsDir(model);
		const manifest = this.resolveManifest();
		const ort = await this.importOnnxRuntime();

		const session = await this.loadSession(ort, modelsDir, manifest);
		try {
			const tokenIds = await this.tokenize(modelsDir, manifest, text);
			const audio = await this.runInference(ort, session, tokenIds, manifest);
			const wav = encodePcm16Wav(audio, manifest.sampleRate);
			const durationMs = Math.round((audio.length / manifest.sampleRate) * 1000);
			const filename = `narration-vv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.wav`;
			const saved = await this.config.assetStorage.saveAudio(wav, filename);
			return { audioUrl: saved.url, durationMs };
		} finally {
			await session.release().catch(() => {});
		}
	}

	async listVoices(): Promise<{ id: string; name: string; lang: string; gender: string }[]> {
		return [];
	}

	listModels(): Array<{ value: string; label: string }> {
		return AiModels.listNarrationModelCards('vibevoice-local').map((m) => ({
			value: m.value,
			label: m.label,
		}));
	}

	listVoicesForModel(model?: string): Array<{ value: string; label: string }> {
		const card = resolveVibeVoiceModelCard(model);
		return card.voices.map((v) => ({ value: v.value, label: v.label }));
	}

	listLanguagesForModel(model?: string): Array<{ value: string; label: string }> {
		const card = resolveVibeVoiceModelCard(model);
		return card.languages.map((l) => ({ value: l.value, label: l.label }));
	}

	async isModelLocal(model: string): Promise<boolean> {
		if (!model.trim()) return false;
		assertVibeVoiceModel(model);
		const modelsDir = this.resolveModelsDir(model);
		const manifest = this.resolveManifest();
		try {
			const { existsSync } = await import('node:fs');
			const { join } = await import('node:path');
			return existsSync(join(modelsDir, manifest.textEncoder)) &&
				existsSync(join(modelsDir, manifest.acousticDecoder));
		} catch {
			return false;
		}
	}

	async ensureModelReady(model: string): Promise<void> {
		if (!model.trim()) throw new Error('Model is required to download VibeVoice ONNX weights.');
		assertVibeVoiceModel(model);
		const isLocal = await this.isModelLocal(model);
		if (!isLocal) {
			throw new Error(
				`VibeVoice model "${model}" is not available locally. ` +
				'Download the ONNX model files to the configured models directory before use.',
			);
		}
	}

	private resolveModelsDir(model: string): string {
		const base = this.config.modelsDir || process.env.VIBEVOICE_MODELS_DIR || '';
		if (!base) {
			throw new Error(
				'VibeVoice models directory is not configured. ' +
				'Set VIBEVOICE_MODELS_DIR or provide modelsDir in the gateway config.',
			);
		}
		const modelSlug = model.replace(/\//g, '--');
		return `${base}/${modelSlug}`;
	}

	private resolveManifest(): VibeVoiceModelManifest {
		return { ...MANIFEST_DEFAULTS };
	}

	private async loadSession(
		ort: OnnxRuntimeModule,
		modelsDir: string,
		manifest: VibeVoiceModelManifest,
	): Promise<OrtInferenceSession> {
		const { join } = await import('node:path');
		const acousticPath = join(modelsDir, manifest.acousticDecoder);
		return ort.InferenceSession.create(acousticPath, {
			executionProviders: ['cpu'],
		});
	}

	private async tokenize(
		modelsDir: string,
		manifest: VibeVoiceModelManifest,
		text: string,
	): Promise<number[]> {
		const { readFile } = await import('node:fs/promises');
		const { join } = await import('node:path');
		const tokenizerPath = join(modelsDir, manifest.tokenizer);
		const tokenizerJson = JSON.parse(await readFile(tokenizerPath, 'utf-8'));
		return simpleTokenize(tokenizerJson, text);
	}

	private async runInference(
		ort: OnnxRuntimeModule,
		session: OrtInferenceSession,
		tokenIds: number[],
		manifest: VibeVoiceModelManifest,
	): Promise<Float32Array> {
		const inputTensor = new ort.Tensor(
			'int64',
			BigInt64Array.from(tokenIds.map(BigInt)),
			[1, tokenIds.length],
		);
		const result = await session.run({ input_ids: inputTensor });
		const outputKey = Object.keys(result).find((k) => k.includes('audio') || k === 'output') || Object.keys(result)[0];
		if (!outputKey || !result[outputKey]) {
			throw new Error('VibeVoice ONNX inference returned no audio output tensor.');
		}
		const output = result[outputKey];
		if (!(output.data instanceof Float32Array)) {
			throw new Error('VibeVoice ONNX inference output is not Float32Array audio data.');
		}
		void manifest;
		return output.data;
	}

	private async importOnnxRuntime(): Promise<OnnxRuntimeModule> {
		if (this.config.importOnnxRuntime) return this.config.importOnnxRuntime();
		try {
			const mod = await import('onnxruntime-node');
			return (mod.default ?? mod) as OnnxRuntimeModule;
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			throw new Error(
				`Failed to load onnxruntime-node for VibeVoice inference: ${msg}. ` +
				'Ensure onnxruntime-node is installed.',
				{ cause: error },
			);
		}
	}
}

function simpleTokenize(tokenizerJson: { model?: { vocab?: Record<string, number> }; added_tokens?: Array<{ id: number; content: string }> }, text: string): number[] {
	const vocab = tokenizerJson.model?.vocab;
	if (!vocab || typeof vocab !== 'object') {
		throw new Error('Tokenizer JSON missing model.vocab field.');
	}

	const tokens: number[] = [];
	const chars = [...text.toLowerCase()];
	for (const char of chars) {
		const id = vocab[char] ?? vocab[`▁${char}`] ?? vocab['[UNK]'] ?? 0;
		tokens.push(id);
	}
	return tokens;
}

function assertVibeVoiceModel(model: string): void {
	const trimmed = model.trim();
	if (!trimmed) throw new Error('Model is required for VibeVoice local narration.');
	const card = AiModels.findNarrationModelCard(trimmed);
	if (card && card.provider !== 'vibevoice-local') {
		throw new Error(`Model "${trimmed}" is not a VibeVoice model. Use the huggingface-local provider instead.`);
	}
}

function resolveVibeVoiceModelCard(model?: string): AiModels.NarrationModelCard {
	const selected = (model ?? '').trim() || DEFAULT_VIBEVOICE_MODEL;
	const card = AiModels.findNarrationModelCardForProvider('vibevoice-local', selected);
	if (card) return card;
	return {
		provider: 'vibevoice-local',
		value: selected,
		label: selected,
		availability: 'missing',
		status: 'experimental',
		badges: ['local'],
		voices: [{ value: 'default', label: 'Default speaker control', stability: 'experimental' }],
		languages: [{ value: 'auto', label: 'Auto (infer from text)', stability: 'experimental' }],
	};
}
