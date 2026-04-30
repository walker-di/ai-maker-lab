import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { json } from '@sveltejs/kit';
import { Marketing } from 'domain/application';
import { getAppDbConfig } from './db-config.js';

function isZodValidationError(error: unknown): error is { issues: Array<{ path: PropertyKey[]; message: string }>; errors?: Array<{ path: PropertyKey[]; message: string }> } {
	if (typeof error !== 'object' || error === null) return false;
	const items: unknown[] | undefined =
		('issues' in error && Array.isArray((error as { issues: unknown }).issues))
			? (error as { issues: unknown[] }).issues
			: ('errors' in error && Array.isArray((error as { errors: unknown }).errors))
				? (error as { errors: unknown[] }).errors
				: undefined;
	if (!items || items.length === 0) return false;
	const first = items[0] as { path?: unknown } | undefined;
	return Array.isArray(first?.path);
}

function isProviderError(error: unknown): boolean {
	const msg = error instanceof Error ? error.message.toLowerCase() : '';
	if (msg.includes('quota') || msg.includes('rate limit') || msg.includes('rate_limit')) return true;
	if (msg.includes('hugging face narration failed') || msg.includes('transformers tts')) return true;
	if (typeof error !== 'object' || error === null) return false;
	const issues = 'issues' in error && Array.isArray((error as { issues: unknown }).issues)
		? (error as { issues: unknown[] }).issues
		: [];
	const firstMsg = typeof (issues[0] as { message?: unknown })?.message === 'string'
		? ((issues[0] as { message: string }).message).toLowerCase()
		: '';
	return firstMsg.includes('quota') || firstMsg.includes('rate limit') || firstMsg.includes('rate_limit') ||
		firstMsg.includes('billing') || firstMsg.includes('api key');
}
import {
	getDb,
	SurrealDbAdapter,
	SurrealProductRepository,
	SurrealPersonaRepository,
	SurrealCampaignRepository,
	SurrealCreativeRepository,
	SurrealStoryRepository,
	SurrealSceneRepository,
	SurrealClipRepository,
	SurrealBgmRepository,
	SurrealCanvasTemplateRepository,
	SurrealStrategyRepository,
	SurrealSceneTransitionRepository,
	AiSdkMarketingTextGateway,
	LocalMarketingAssetStorage,
} from 'domain/infrastructure';
import { AzureSpeechNarrationGateway } from './marketing/gateways/AzureSpeechNarrationGateway.js';
import { HuggingFaceTransformersNarrationGateway } from './marketing/gateways/HuggingFaceTransformersNarrationGateway.js';
import { OpenAIMarketingMediaGateway } from './marketing/gateways/OpenAIMarketingMediaGateway.js';
import { ReplicateMarketingMediaGateway } from './marketing/gateways/ReplicateMarketingMediaGateway.js';
import { FfmpegMarketingVideoExporter } from './marketing/gateways/FfmpegMarketingVideoExporter.js';

class CompositeMarketingMediaGateway
	implements Marketing.IMarketingImageGenerationGateway, Marketing.IBackgroundMusicGateway
{
	constructor(
		private readonly openai: OpenAIMarketingMediaGateway | null,
		private readonly replicate: ReplicateMarketingMediaGateway | null,
	) {}

	private resolveImageGateway(model?: string): Marketing.IMarketingImageGenerationGateway {
		if (model && model.includes('/')) {
			if (!this.replicate) throw new Error('Replicate API key not configured. Set REPLICATE_API_KEY to use Replicate models.');
			return this.replicate;
		}
		if (model && (model.startsWith('gpt-') || model.startsWith('dall-'))) {
			if (!this.openai) throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY to use OpenAI image models.');
			return this.openai;
		}
		return this.openai ?? this.replicate!;
	}

	async generateImage(prompt: string, style?: string, options?: { aspectRatio?: string; model?: string }): Promise<{ url: string }> {
		const gateway = this.resolveImageGateway(options?.model);
		return gateway.generateImage(prompt, style, options);
	}

	async generateSvg(prompt: string): Promise<{ svgContent: string }> {
		const gateway = this.openai ?? this.replicate!;
		return gateway.generateSvg(prompt);
	}

	async generate(prompt: string, durationSecs: number): Promise<{ url: string }> {
		if (!this.replicate) throw new Error('Replicate API key not configured. BGM generation requires Replicate.');
		return this.replicate.generate(prompt, durationSecs);
	}
}

type NarrationProvider = 'azure' | 'huggingface-local' | 'vibevoice-local';

export class CompositeNarrationAudioGateway implements Marketing.INarrationAudioGateway {
	constructor(
		private readonly defaultProvider: NarrationProvider,
		private readonly gateways: Record<NarrationProvider, Marketing.INarrationAudioGateway>,
	) {}

	async synthesize(
		text: string,
		voice?: string,
		lang?: string,
		options?: { provider?: string; model?: string },
	): Promise<{ audioUrl: string; durationMs: number }> {
		const provider = options?.provider
			? normalizeNarrationProvider(options.provider, 'narration provider')
			: this.defaultProvider;
		return this.gateways[provider].synthesize(text, voice, lang, options);
	}

	async listVoices(): Promise<{ id: string; name: string; lang: string; gender: string }[]> {
		return this.gateways[this.defaultProvider].listVoices();
	}
}

export interface MarketingServices {
	productService: Marketing.ProductService;
	personaService: Marketing.PersonaService;
	campaignService: Marketing.CampaignService;
	creativeService: Marketing.CreativeService;
	storyService: Marketing.StoryService;
	sceneService: Marketing.SceneService;
	clipService: Marketing.ClipService;
	bgmService: Marketing.BgmService;
	canvasTemplateService: Marketing.CanvasTemplateService;
	strategyService: Marketing.StrategyService;
	videoExportService: Marketing.VideoExportService;
	storyboardService: Marketing.StoryboardService;
	assetStorage: Marketing.IMarketingAssetStorage;
	// Repos exposed for list-all queries not covered by service methods
	personaRepo: Marketing.IPersonaRepository;
	creativeRepo: Marketing.ICreativeRepository;
	storyRepo: Marketing.IStoryRepository;
	sceneRepo: Marketing.ISceneRepository;
	clipRepo: Marketing.IClipRepository;
	transitionRepo: Marketing.ISceneTransitionRepository;
}

let marketingServicesPromise: Promise<MarketingServices> | undefined;

/** For use in tests only — resets the service singleton so a new DB config can take effect. */
export function resetMarketingServicesForTest(): void {
	marketingServicesPromise = undefined;
}

function parseTextModelConfig(): {
	provider: 'anthropic' | 'openai' | 'google';
	model: string;
	apiKey?: string;
} {
	const raw = process.env.MARKETING_DEFAULT_TEXT_MODEL ?? 'openai:gpt-4o-mini';
	const [provider, ...rest] = raw.split(':');
	const model = rest.join(':');
	const providerName =
		provider === 'anthropic' || provider === 'openai' || provider === 'google'
			? provider
			: 'openai';
	const apiKeyMap: Record<string, string | undefined> = {
		anthropic: process.env.ANTHROPIC_API_KEY,
		openai: process.env.OPENAI_API_KEY,
		google: process.env.GOOGLE_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY,
	};
	return {
		provider: providerName,
		model: model || 'gpt-4o-mini',
		apiKey: apiKeyMap[providerName],
	};
}

export function createNarrationAudioGateway(config: {
	provider?: string;
	azure: { apiKey: string; region: string; voice: string };
	assetStorage: Marketing.IMarketingAssetStorage;
}): Marketing.INarrationAudioGateway {
	const defaultProvider = normalizeNarrationProvider(config.provider, 'MARKETING_NARRATION_PROVIDER');
	return new CompositeNarrationAudioGateway(defaultProvider, {
		azure: new AzureSpeechNarrationGateway({
			apiKey: config.azure.apiKey,
			region: config.azure.region,
			voice: config.azure.voice,
			assetStorage: config.assetStorage,
		}),
		'huggingface-local': new HuggingFaceTransformersNarrationGateway({
			assetStorage: config.assetStorage,
			model: process.env.MARKETING_HF_TTS_MODEL,
			voice: process.env.MARKETING_HF_TTS_VOICE,
			language: process.env.MARKETING_HF_TTS_LANGUAGE,
		}),
		'vibevoice-local': new UnconfiguredNarrationGateway(
			'VibeVoice local narration is not configured in this app yet. Use MARKETING_NARRATION_PROVIDER=azure or huggingface-local, or add a dedicated VibeVoice adapter.',
		),
	});
}

function normalizeNarrationProvider(provider?: string, source = 'MARKETING_NARRATION_PROVIDER'): NarrationProvider {
	if (!provider || provider === 'azure') return 'azure';
	if (provider === 'huggingface-local' || provider === 'vibevoice-local') return provider;
	throw new MarketingProviderConfigurationError(
		`Unsupported ${source} "${provider}". Use azure, huggingface-local, or vibevoice-local.`,
	);
}

export function getMarketingServices(): Promise<MarketingServices> {
	if (!marketingServicesPromise) {
		marketingServicesPromise = (async () => {
			try {
				const surreal = await getDb(getAppDbConfig());

				const adapter = new SurrealDbAdapter(surreal);

				const productRepo = new SurrealProductRepository(adapter);
				const personaRepo = new SurrealPersonaRepository(adapter);
				const campaignRepo = new SurrealCampaignRepository(adapter);
				const creativeRepo = new SurrealCreativeRepository(adapter);
				const storyRepo = new SurrealStoryRepository(adapter);
				const sceneRepo = new SurrealSceneRepository(adapter);
				const clipRepo = new SurrealClipRepository(adapter);
				const bgmRepo = new SurrealBgmRepository(adapter);
				const templateRepo = new SurrealCanvasTemplateRepository(adapter);
				const strategyRepo = new SurrealStrategyRepository(adapter);
				const transitionRepo = new SurrealSceneTransitionRepository(adapter);

				const textModelConfig = parseTextModelConfig();
				const aiGateway: Marketing.IMarketingTextGenerationGateway = textModelConfig.apiKey
					? new AiSdkMarketingTextGateway(textModelConfig)
					: new UnconfiguredMarketingTextGateway(textModelConfig.provider);

				const assetRoot =
					process.env.MARKETING_ASSET_ROOT ??
					fileURLToPath(new URL('../../../../../data/marketing-assets', import.meta.url));
				const publicBaseUrl =
					process.env.MARKETING_PUBLIC_ASSET_BASE_URL ?? '/marketing-assets';
				mkdirSync(assetRoot, { recursive: true });

				const assetStorage = new LocalMarketingAssetStorage({ assetRoot, publicBaseUrl });

				const openaiApiKey = process.env.OPENAI_API_KEY ?? '';
				const replicateApiKey = process.env.REPLICATE_API_KEY ?? '';

				const openaiImageGateway = openaiApiKey
					? new OpenAIMarketingMediaGateway(openaiApiKey, {
							imageModel: process.env.MARKETING_DEFAULT_IMAGE_MODEL,
						})
					: null;
				const replicateGateway = replicateApiKey
					? new ReplicateMarketingMediaGateway(replicateApiKey, {
							imageModel: process.env.MARKETING_DEFAULT_IMAGE_MODEL,
						})
					: null;

				const imageGen: Marketing.IMarketingImageGenerationGateway & Marketing.IBackgroundMusicGateway =
					new CompositeMarketingMediaGateway(openaiImageGateway, replicateGateway);

				const narrationGateway = createNarrationAudioGateway({
					provider: process.env.MARKETING_NARRATION_PROVIDER,
					azure: {
						apiKey: process.env.AZURE_SPEECH_KEY ?? '',
						region: process.env.AZURE_SPEECH_REGION ?? 'eastus',
						voice: process.env.AZURE_SPEECH_VOICE ?? 'en-US-JennyNeural',
					},
					assetStorage,
				});

				const videoExporter = new FfmpegMarketingVideoExporter({
					ffmpegPath: process.env.FFMPEG_PATH,
					ffprobePath: process.env.FFPROBE_PATH,
					tempDir: assetRoot,
					publicBaseUrl,
				});

				const productService = new Marketing.ProductService(productRepo, personaRepo, aiGateway);
				const personaService = new Marketing.PersonaService(personaRepo, productRepo, aiGateway);
				const campaignService = new Marketing.CampaignService(campaignRepo);
				const creativeService = new Marketing.CreativeService(
					creativeRepo,
					aiGateway,
					imageGen,
					assetStorage,
				);
				const storyService = new Marketing.StoryService(storyRepo);
				const sceneService = new Marketing.SceneService(sceneRepo);
				const clipService = new Marketing.ClipService(
					clipRepo,
					aiGateway,
					narrationGateway,
					imageGen,
				);
				const bgmService = new Marketing.BgmService(bgmRepo, imageGen);
				const canvasTemplateService = new Marketing.CanvasTemplateService(templateRepo);
				const strategyService = new Marketing.StrategyService(strategyRepo, aiGateway);
				const videoExportService = new Marketing.VideoExportService(
					clipRepo,
					sceneRepo,
					storyRepo,
					videoExporter,
				);
				const storyboardService = new Marketing.StoryboardService(
					storyRepo,
					sceneRepo,
					clipRepo,
					aiGateway,
					imageGen,
					narrationGateway,
					imageGen,
					videoExporter,
				);

				return {
					productService,
					personaService,
					campaignService,
					creativeService,
					storyService,
					sceneService,
					clipService,
					bgmService,
					canvasTemplateService,
					strategyService,
					videoExportService,
					storyboardService,
					assetStorage,
					personaRepo,
					creativeRepo,
					storyRepo,
					sceneRepo,
					clipRepo,
					transitionRepo,
				};
			} catch (error) {
				marketingServicesPromise = undefined;
				throw error;
			}
		})();
	}
	return marketingServicesPromise;
}

class UnconfiguredMarketingTextGateway implements Marketing.IMarketingTextGenerationGateway {
	constructor(private readonly provider: string) {}

	private fail(): never {
		throw new MarketingProviderConfigurationError(
			`AI provider not configured. Set ${providerEnvKey(this.provider)} to enable AI features.`,
		);
	}

	generateProductDescription() { return Promise.resolve(this.fail()); }
	generatePersonas() { return Promise.resolve(this.fail()); }
	generateCreativeText() { return Promise.resolve(this.fail()); }
	generateMarketingStrategy() { return Promise.resolve(this.fail()); }
	generateStoryboard() { return Promise.resolve(this.fail()); }
}

class UnconfiguredNarrationGateway implements Marketing.INarrationAudioGateway {
	constructor(private readonly message: string) {}

	async synthesize(): Promise<{ audioUrl: string; durationMs: number }> {
		throw new MarketingProviderConfigurationError(this.message);
	}

	async listVoices(): Promise<{ id: string; name: string; lang: string; gender: string }[]> {
		return [];
	}
}

export class MarketingProviderConfigurationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'MarketingProviderConfigurationError';
	}
}

function providerEnvKey(provider: string): string {
	const keys: Record<string, string> = {
		anthropic: 'ANTHROPIC_API_KEY',
		openai: 'OPENAI_API_KEY',
		google: 'GOOGLE_API_KEY',
	};
	return keys[provider] ?? 'the provider API key';
}

export function toMarketingErrorResponse(error: unknown) {
	if (error instanceof MarketingProviderConfigurationError) {
		return json({ error: error.message }, { status: 503 });
	}
	if (error instanceof Marketing.StoryboardGenerationError) {
		return json({ error: error.message }, { status: 502 });
	}
	if (isProviderError(error)) {
		const message = error instanceof Error ? error.message : 'AI provider error';
		return json({ error: message }, { status: 502 });
	}
	if (isZodValidationError(error)) {
		const items = ('issues' in error && Array.isArray(error.issues)) ? error.issues : error.errors!;
		const issues = items
			.map((e) => `${(e.path as string[]).join('.')}: ${e.message}`)
			.join('; ');
		return json({ error: `Validation failed: ${issues}` }, { status: 400 });
	}
	const message = error instanceof Error ? error.message : 'Unknown error';
	const lower = message.toLowerCase();
	const isProviderSchemaError =
		lower.includes('invalid schema for response_format') ||
		((lower.includes('response_format') || lower.includes('json_schema') || lower.includes('json schema')) &&
			(lower.includes('missing') || lower.includes('invalid') || lower.includes('error')));
	const isAiGenerationError =
		lower.includes('no object generated') ||
		lower.includes('did not match the schema') ||
		lower.includes('failed to generate') ||
		lower.includes('quota') ||
		lower.includes('rate limit');
	const status = isProviderSchemaError || isAiGenerationError
		? 502
		: lower.includes('not found')
			? 404
			: lower.includes('cannot delete') || lower.includes('associated')
				? 409
				: lower.includes('invalid') || lower.includes('required')
					? 400
					: 500;
	return json({ error: message }, { status });
}
