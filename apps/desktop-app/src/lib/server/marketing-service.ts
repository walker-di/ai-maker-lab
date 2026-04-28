import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { json } from '@sveltejs/kit';
import { Marketing } from 'domain/application';
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
import { ReplicateMarketingMediaGateway } from './marketing/gateways/ReplicateMarketingMediaGateway.js';
import { FfmpegMarketingVideoExporter } from './marketing/gateways/FfmpegMarketingVideoExporter.js';

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

function getDefaultEmbeddedHost(): string {
	const dbPath = fileURLToPath(
		new URL('../../../../../data/surrealdb/desktop-web.db', import.meta.url),
	);
	mkdirSync(dirname(dbPath), { recursive: true });
	return `surrealkv://${dbPath}`;
}

function parseTextModelConfig(): {
	provider: 'anthropic' | 'openai' | 'google';
	model: string;
	apiKey?: string;
} {
	const raw = process.env.MARKETING_DEFAULT_TEXT_MODEL ?? 'anthropic:claude-3-5-haiku-20241022';
	const [provider, ...rest] = raw.split(':');
	const model = rest.join(':');
	const providerName =
		provider === 'anthropic' || provider === 'openai' || provider === 'google'
			? provider
			: 'anthropic';
	const apiKeyMap: Record<string, string | undefined> = {
		anthropic: process.env.ANTHROPIC_API_KEY,
		openai: process.env.OPENAI_API_KEY,
		google: process.env.GOOGLE_API_KEY,
	};
	return {
		provider: providerName,
		model: model || 'claude-3-5-haiku-20241022',
		apiKey: apiKeyMap[providerName],
	};
}

export function getMarketingServices(): Promise<MarketingServices> {
	if (!marketingServicesPromise) {
		marketingServicesPromise = (async () => {
			const surreal = await getDb({
				host: process.env.SURREAL_HOST ?? getDefaultEmbeddedHost(),
				namespace: process.env.SURREAL_NS ?? 'app',
				database: process.env.SURREAL_DB ?? 'desktop',
				username: process.env.SURREAL_USER,
				password: process.env.SURREAL_PASS,
				token: process.env.SURREAL_TOKEN,
			});

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

			const aiGateway = new AiSdkMarketingTextGateway(parseTextModelConfig());

			const assetRoot =
				process.env.MARKETING_ASSET_ROOT ??
				fileURLToPath(new URL('../../../../../data/marketing-assets', import.meta.url));
			const publicBaseUrl =
				process.env.MARKETING_PUBLIC_ASSET_BASE_URL ?? '/marketing-assets';
			mkdirSync(assetRoot, { recursive: true });

			const assetStorage = new LocalMarketingAssetStorage({ assetRoot, publicBaseUrl });

			const replicateApiKey = process.env.REPLICATE_API_KEY ?? '';
			const imageGen = new ReplicateMarketingMediaGateway(replicateApiKey, {
				imageModel: process.env.MARKETING_DEFAULT_IMAGE_MODEL,
			});

			const narrationGateway = new AzureSpeechNarrationGateway({
				apiKey: process.env.AZURE_SPEECH_KEY ?? '',
				region: process.env.AZURE_SPEECH_REGION ?? 'eastus',
				voice: process.env.AZURE_SPEECH_VOICE ?? 'en-US-JennyNeural',
				outputDir: assetRoot,
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
		})();
	}
	return marketingServicesPromise;
}

export function toMarketingErrorResponse(error: unknown) {
	const message = error instanceof Error ? error.message : 'Unknown error';
	const lower = message.toLowerCase();
	const status = lower.includes('not found')
		? 404
		: lower.includes('cannot delete') || lower.includes('associated')
			? 409
			: lower.includes('invalid') || lower.includes('required')
				? 400
				: 500;
	return json({ error: message }, { status });
}
