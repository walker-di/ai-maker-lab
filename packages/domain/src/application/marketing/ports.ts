import type {
  Product,
  Campaign,
  Persona,
  Strategy,
  Creative,
  Story,
  Scene,
  Clip,
  BgmFile,
  CanvasTemplate,
  SceneTransition,
  CreativeType,
  CreateProductDto,
  UpdateProductDto,
  CreateCampaignDto,
  UpdateCampaignDto,
  CreatePersonaDto,
  UpdatePersonaDto,
  CreateStrategyDto,
  UpdateStrategyDto,
  CreateCreativeDto,
  UpdateCreativeDto,
  CreateStoryDto,
  UpdateStoryDto,
  CreateSceneDto,
  UpdateSceneDto,
  CreateClipDto,
  UpdateClipDto,
  CreateBgmFileDto,
  UpdateBgmFileDto,
  CreateCanvasTemplateDto,
  UpdateCanvasTemplateDto,
  StoryboardDetail,
  StoryboardFrame,
  GeneratedStoryboardFrameDraft,
  StoryboardPromptType,
  StoryboardAssetType,
} from '../../shared/marketing/index.js';

export interface IProductRepository {
  findAll(): Promise<Product[]>;
  findById(id: string): Promise<Product | null>;
  create(data: CreateProductDto): Promise<Product>;
  update(id: string, data: UpdateProductDto): Promise<Product>;
  delete(id: string): Promise<void>;
}

export interface ICampaignRepository {
  findAll(): Promise<Campaign[]>;
  findById(id: string): Promise<Campaign | null>;
  findByProductId(productId: string): Promise<Campaign[]>;
  create(data: CreateCampaignDto): Promise<Campaign>;
  update(id: string, data: UpdateCampaignDto): Promise<Campaign>;
  delete(id: string): Promise<void>;
}

export interface IPersonaRepository {
  findAll(): Promise<Persona[]>;
  findById(id: string): Promise<Persona | null>;
  findByProductId(productId: string): Promise<Persona[]>;
  create(data: CreatePersonaDto): Promise<Persona>;
  update(id: string, data: UpdatePersonaDto): Promise<Persona>;
  delete(id: string): Promise<void>;
}

export interface IStrategyRepository {
  findAll(): Promise<Strategy[]>;
  findById(id: string): Promise<Strategy | null>;
  findByProductId(productId: string): Promise<Strategy[]>;
  create(data: CreateStrategyDto): Promise<Strategy>;
  update(id: string, data: UpdateStrategyDto): Promise<Strategy>;
  delete(id: string): Promise<void>;
}

export interface ICreativeRepository {
  findAll(): Promise<Creative[]>;
  findById(id: string): Promise<Creative | null>;
  findByProductId(productId: string): Promise<Creative[]>;
  create(data: CreateCreativeDto): Promise<Creative>;
  update(id: string, data: UpdateCreativeDto): Promise<Creative>;
  delete(id: string): Promise<void>;
}

export interface IStoryRepository {
  findAll(): Promise<Story[]>;
  findById(id: string): Promise<Story | null>;
  findByCreativeId(creativeId: string): Promise<Story[]>;
  create(data: CreateStoryDto): Promise<Story>;
  update(id: string, data: UpdateStoryDto): Promise<Story>;
  delete(id: string): Promise<void>;
}

export interface ISceneRepository {
  findAll(): Promise<Scene[]>;
  findById(id: string): Promise<Scene | null>;
  findByStoryId(storyId: string): Promise<Scene[]>;
  create(data: CreateSceneDto): Promise<Scene>;
  update(id: string, data: UpdateSceneDto): Promise<Scene>;
  delete(id: string): Promise<void>;
}

export interface IClipRepository {
  findAll(): Promise<Clip[]>;
  findById(id: string): Promise<Clip | null>;
  findBySceneId(sceneId: string): Promise<Clip[]>;
  create(data: CreateClipDto): Promise<Clip>;
  update(id: string, data: UpdateClipDto): Promise<Clip>;
  delete(id: string): Promise<void>;
}

export interface IBgmRepository {
  findAll(): Promise<BgmFile[]>;
  findById(id: string): Promise<BgmFile | null>;
  create(data: CreateBgmFileDto): Promise<BgmFile>;
  update(id: string, data: UpdateBgmFileDto): Promise<BgmFile>;
  delete(id: string): Promise<void>;
}

export interface ICanvasTemplateRepository {
  findAll(): Promise<CanvasTemplate[]>;
  findById(id: string): Promise<CanvasTemplate | null>;
  create(data: CreateCanvasTemplateDto): Promise<CanvasTemplate>;
  update(id: string, data: UpdateCanvasTemplateDto): Promise<CanvasTemplate>;
  delete(id: string): Promise<void>;
}

export interface ISceneTransitionRepository {
  findAll(): Promise<SceneTransition[]>;
  findById(id: string): Promise<SceneTransition | null>;
  create(data: Omit<SceneTransition, 'id' | 'createdAt' | 'updatedAt'>): Promise<SceneTransition>;
  update(id: string, data: Partial<Omit<SceneTransition, 'id' | 'createdAt' | 'updatedAt'>>): Promise<SceneTransition>;
  delete(id: string): Promise<void>;
}

export interface IMarketingTextGenerationGateway {
  generateProductDescription(product: Partial<Product>): Promise<string>;
  generatePersonas(product: Product, count: number): Promise<Partial<Persona>[]>;
  generateCreativeText(product: Product, persona: Persona, type: CreativeType): Promise<string>;
  generateMarketingStrategy(product: Product, campaign?: Campaign): Promise<string>;
  generateStoryboard(
    product: Product,
    creative: Creative,
  ): Promise<{ scenes: Partial<Scene>[]; clips: Partial<Clip>[][] }>;
  generateStoryboardFrames?(prompt: string, count: number, modelOverride?: { provider: string; model: string }): Promise<GeneratedStoryboardFrameDraft[]>;
  regenerateStoryboardPrompt?(params: {
    promptType: StoryboardPromptType;
    frame: StoryboardFrame;
    storyboard: StoryboardDetail;
    modelOverride?: { provider: string; model: string };
  }): Promise<string>;
}

export interface IMarketingImageGenerationGateway {
  generateImage(prompt: string, style?: string, options?: { aspectRatio?: string; model?: string }): Promise<{ url: string }>;
  generateSvg(prompt: string): Promise<{ svgContent: string }>;
}

export interface INarrationAudioGateway {
  synthesize(text: string, voice: string, lang?: string): Promise<{ audioUrl: string; durationMs: number }>;
  listVoices(): Promise<{ id: string; name: string; lang: string; gender: string }[]>;
}

export interface IBackgroundMusicGateway {
  generate(prompt: string, durationSecs: number): Promise<{ url: string }>;
}

export interface IMarketingAssetStorage {
  saveImage(buffer: Buffer, filename: string): Promise<{ url: string; path: string }>;
  saveAudio(buffer: Buffer, filename: string): Promise<{ url: string; path: string }>;
  listImages(prefix?: string): Promise<{ url: string; path: string }[]>;
  listAudio(prefix?: string): Promise<{ url: string; path: string }[]>;
  readFile(path: string): Promise<Buffer>;
}

export interface IStoryboardAssetGenerationGateway {
  generateFrameAsset(params: {
    frame: StoryboardFrame;
    assetType: StoryboardAssetType;
  }): Promise<{ url: string; durationMs?: number }>;
}

export interface IVideoExporter {
  exportClip(params: {
    imageUrl?: string;
    narrationUrl?: string;
    durationMs: number;
    outputPath: string;
  }): Promise<{ videoPath: string }>;
  exportStory(params: {
    clips: { videoPath: string; durationMs: number }[];
    bgmUrl?: string;
    outputPath: string;
  }): Promise<{ videoPath: string; durationMs: number }>;
}
