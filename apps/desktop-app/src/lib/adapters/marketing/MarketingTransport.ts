import type { Marketing } from 'domain/shared';

export type Product = Marketing.Product;
export type Campaign = Marketing.Campaign;
export type Persona = Marketing.Persona;
export type Creative = Marketing.Creative;
export type Story = Marketing.Story;
export type Scene = Marketing.Scene;
export type Clip = Marketing.Clip;
export type BgmFile = Marketing.BgmFile;
export type CanvasTemplate = Marketing.CanvasTemplate;
export type Strategy = Marketing.Strategy;
export type SceneTransition = Marketing.SceneTransition;
export type AudioSettings = Marketing.AudioSettings;

export type CreateProductDto = Marketing.CreateProductDto;
export type UpdateProductDto = Marketing.UpdateProductDto;
export type CreateCampaignDto = Marketing.CreateCampaignDto;
export type UpdateCampaignDto = Marketing.UpdateCampaignDto;
export type CreatePersonaDto = Marketing.CreatePersonaDto;
export type UpdatePersonaDto = Marketing.UpdatePersonaDto;
export type CreateStrategyDto = Marketing.CreateStrategyDto;
export type UpdateStrategyDto = Marketing.UpdateStrategyDto;
export type CreateCreativeDto = Marketing.CreateCreativeDto;
export type UpdateCreativeDto = Marketing.UpdateCreativeDto;
export type CreateStoryDto = Marketing.CreateStoryDto;
export type UpdateStoryDto = Marketing.UpdateStoryDto;
export type CreateSceneDto = Marketing.CreateSceneDto;
export type UpdateSceneDto = Marketing.UpdateSceneDto;
export type CreateClipDto = Marketing.CreateClipDto;
export type UpdateClipDto = Marketing.UpdateClipDto;
export type CreateBgmFileDto = Marketing.CreateBgmFileDto;
export type UpdateBgmFileDto = Marketing.UpdateBgmFileDto;
export type CreateCanvasTemplateDto = Marketing.CreateCanvasTemplateDto;
export type UpdateCanvasTemplateDto = Marketing.UpdateCanvasTemplateDto;

export interface MarketingCatalogTransport {
	// products
	listProducts(): Promise<Product[]>;
	getProduct(id: string): Promise<Product>;
	createProduct(data: CreateProductDto): Promise<Product>;
	updateProduct(id: string, data: UpdateProductDto): Promise<Product>;
	deleteProduct(id: string): Promise<void>;
	generateProduct(name: string): Promise<Product>;

	// personas
	listPersonas(productId?: string): Promise<Persona[]>;
	getPersona(id: string): Promise<Persona>;
	createPersona(data: CreatePersonaDto): Promise<Persona>;
	updatePersona(id: string, data: UpdatePersonaDto): Promise<Persona>;
	deletePersona(id: string): Promise<void>;
	generatePersonas(productId: string, count?: number): Promise<Persona[]>;

	// campaigns
	listCampaigns(): Promise<Campaign[]>;
	getCampaign(id: string): Promise<Campaign>;
	createCampaign(data: CreateCampaignDto): Promise<Campaign>;
	updateCampaign(id: string, data: UpdateCampaignDto): Promise<Campaign>;
	deleteCampaign(id: string): Promise<void>;

	// creatives
	listCreatives(productId?: string): Promise<Creative[]>;
	getCreative(id: string): Promise<Creative>;
	createCreative(data: CreateCreativeDto): Promise<Creative>;
	updateCreative(id: string, data: UpdateCreativeDto): Promise<Creative>;
	deleteCreative(id: string): Promise<void>;

	// stories
	listStories(creativeId?: string): Promise<Story[]>;
	getStory(id: string): Promise<Story>;
	createStory(data: CreateStoryDto): Promise<Story>;
	updateStory(id: string, data: UpdateStoryDto): Promise<Story>;
	deleteStory(id: string): Promise<void>;
	updateAudioSettings(storyId: string, settings: AudioSettings): Promise<Story>;

	// scenes
	listScenes(storyId?: string): Promise<Scene[]>;
	getScene(id: string): Promise<Scene>;
	createScene(data: CreateSceneDto): Promise<Scene>;
	updateScene(id: string, data: UpdateSceneDto): Promise<Scene>;
	deleteScene(id: string): Promise<void>;

	// clips
	listClips(sceneId?: string): Promise<Clip[]>;
	getClip(id: string): Promise<Clip>;
	createClip(data: CreateClipDto): Promise<Clip>;
	updateClip(id: string, data: UpdateClipDto): Promise<Clip>;
	deleteClip(id: string): Promise<void>;

	// bgm
	listBgm(): Promise<BgmFile[]>;
	getBgm(id: string): Promise<BgmFile>;
	createBgm(data: CreateBgmFileDto): Promise<BgmFile>;
	updateBgm(id: string, data: UpdateBgmFileDto): Promise<BgmFile>;
	deleteBgm(id: string): Promise<void>;

	// canvas templates
	listCanvasTemplates(): Promise<CanvasTemplate[]>;
	getCanvasTemplate(id: string): Promise<CanvasTemplate>;
	createCanvasTemplate(data: CreateCanvasTemplateDto): Promise<CanvasTemplate>;
	updateCanvasTemplate(id: string, data: UpdateCanvasTemplateDto): Promise<CanvasTemplate>;
	deleteCanvasTemplate(id: string): Promise<void>;
	duplicateCanvasTemplate(id: string, name?: string): Promise<CanvasTemplate>;

	// transitions
	listTransitions(): Promise<SceneTransition[]>;
	getTransition(id: string): Promise<SceneTransition>;
	createTransition(data: Omit<SceneTransition, 'id' | 'createdAt' | 'updatedAt'>): Promise<SceneTransition>;
	updateTransition(
		id: string,
		data: Partial<Omit<SceneTransition, 'id' | 'createdAt' | 'updatedAt'>>,
	): Promise<SceneTransition>;
	deleteTransition(id: string): Promise<void>;
}

export interface MarketingAiTransport {
	generatePersonas(productId: string, count?: number): Promise<Persona[]>;
	generateCreativeText(
		creativeId: string,
		productId: string,
		personaId: string,
		type: string,
	): Promise<Creative>;
	generateImage(creativeId: string, prompt: string, style?: string): Promise<Creative>;
	generateBgm(prompt: string, duration?: number, name?: string): Promise<BgmFile>;
	aiFillClip(clipId: string): Promise<Clip>;
	generateStrategy(productId: string, campaignId?: string): Promise<Strategy>;
	suggestBgm(sceneId: string): Promise<{ suggestion: string }>;
	autoSelectBgm(sceneId: string): Promise<{ bgm: BgmFile | null }>;
}

export interface MarketingAssetTransport {
	uploadImage(file: File): Promise<{ url: string }>;
	uploadAudio(file: File): Promise<{ url: string }>;
	listImages(): Promise<{ url: string }[]>;
	listAudio(): Promise<{ url: string }[]>;
}

export interface MarketingExportTransport {
	exportStory(storyId: string): Promise<{ videoPath: string; durationMs: number }>;
	exportClip(clipId: string): Promise<{ videoPath: string }>;
}

export interface MarketingStrategyTransport {
	listStrategies(productId?: string): Promise<Strategy[]>;
	getStrategy(id: string): Promise<Strategy>;
	createStrategy(data: CreateStrategyDto): Promise<Strategy>;
	updateStrategy(id: string, data: UpdateStrategyDto): Promise<Strategy>;
	deleteStrategy(id: string): Promise<void>;
	generateStrategy(productId: string, campaignId?: string): Promise<Strategy>;
}
