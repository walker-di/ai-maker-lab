import { z } from 'zod';
import { CreativeType, CampaignStatus, AgeRange, Gender, CanvasAspectRatio, VideoPlatform, VideoFormat } from './constants.js';

const StoryboardTransitionTypeSchema = z.enum(['none', 'fade', 'slide', 'wipe', 'zoom']);
const StoryboardPromptTypeSchema = z.enum(['narration', 'mainImage', 'backgroundImage', 'bgm']);
const StoryboardAssetTypeSchema = z.enum(['mainImage', 'backgroundImage', 'narrationAudio', 'bgm']);

// Product DTOs
export const CreateProductDtoSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  targetAudience: z.string().optional(),
  features: z.array(z.string()).default([]),
  benefits: z.array(z.string()).default([]),
  imageUrl: z.string().url().optional(),
});
export type CreateProductDto = z.infer<typeof CreateProductDtoSchema>;

export const UpdateProductDtoSchema = CreateProductDtoSchema.partial();
export type UpdateProductDto = z.infer<typeof UpdateProductDtoSchema>;

// Campaign DTOs
export const CreateCampaignDtoSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  productId: z.string().optional(),
  status: z.enum([CampaignStatus.draft, CampaignStatus.active, CampaignStatus.paused, CampaignStatus.completed]).default(CampaignStatus.draft),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  goals: z.string().optional(),
  budget: z.number().positive().optional(),
  targetRegions: z.array(z.string()).default([]),
});
export type CreateCampaignDto = z.infer<typeof CreateCampaignDtoSchema>;

export const UpdateCampaignDtoSchema = CreateCampaignDtoSchema.partial();
export type UpdateCampaignDto = z.infer<typeof UpdateCampaignDtoSchema>;

// Persona DTOs
export const CreatePersonaDtoSchema = z.object({
  productId: z.string().min(1),
  name: z.string().min(1),
  age: z.number().int().positive().optional(),
  ageRange: z.enum(['18-24', '25-34', '35-44', '45-54', '55-64', '65+'] as [AgeRange, ...AgeRange[]]),
  gender: z.enum([Gender.male, Gender.female, Gender.non_binary, Gender.all]),
  occupation: z.string().optional(),
  income: z.string().optional(),
  interests: z.array(z.string()).default([]),
  painPoints: z.array(z.string()).default([]),
  motivations: z.array(z.string()).default([]),
  description: z.string().optional(),
  avatarUrl: z.string().url().optional(),
});
export type CreatePersonaDto = z.infer<typeof CreatePersonaDtoSchema>;

export const UpdatePersonaDtoSchema = CreatePersonaDtoSchema.partial();
export type UpdatePersonaDto = z.infer<typeof UpdatePersonaDtoSchema>;

// Creative DTOs
export const CreateCreativeDtoSchema = z.object({
  productId: z.string().min(1),
  personaId: z.string().optional(),
  campaignId: z.string().optional(),
  type: z.enum([CreativeType.text, CreativeType.image, CreativeType.video, CreativeType.landing_page]),
  name: z.string().min(1),
  status: z.string().default('draft'),
  tags: z.array(z.string()).default([]),
});
export type CreateCreativeDto = z.infer<typeof CreateCreativeDtoSchema>;

export const UpdateCreativeDtoSchema = CreateCreativeDtoSchema.partial();
export type UpdateCreativeDto = z.infer<typeof UpdateCreativeDtoSchema>;

// Story DTOs
export const CreateStoryDtoSchema = z.object({
  creativeId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  audioSettings: z.object({
    narrationVoice: z.string().optional(),
    narrationLang: z.string().optional(),
    bgmId: z.string().optional(),
    bgmVolume: z.number().min(0).max(1).optional(),
  }).default({}),
  totalDuration: z.number().nonnegative().optional(),
});
export type CreateStoryDto = z.infer<typeof CreateStoryDtoSchema>;

export const UpdateStoryDtoSchema = CreateStoryDtoSchema.partial();
export type UpdateStoryDto = z.infer<typeof UpdateStoryDtoSchema>;

// Storyboard Maker DTOs
export const GeneratedStoryboardFrameDraftSchema = z.object({
  title: z.string().optional(),
  narration: z.string().min(1),
  mainImagePrompt: z.string().min(1),
  backgroundImagePrompt: z.string().min(1),
  bgmPrompt: z.string().min(1),
  durationMs: z.number().int().positive().optional(),
});
export type GeneratedStoryboardFrameDraftDto = z.infer<typeof GeneratedStoryboardFrameDraftSchema>;

export const CreateStoryboardDtoSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});
export type CreateStoryboardDto = z.infer<typeof CreateStoryboardDtoSchema>;

export const GenerateStoryboardFramesDtoSchema = z.object({
  prompt: z.string().min(1),
  count: z.number().int().min(1).max(20).default(3),
});
export type GenerateStoryboardFramesDto = z.infer<typeof GenerateStoryboardFramesDtoSchema>;

export const InsertBlankStoryboardFrameDtoSchema = z.object({
  afterFrameId: z.string().optional(),
  title: z.string().optional(),
});
export type InsertBlankStoryboardFrameDto = z.infer<typeof InsertBlankStoryboardFrameDtoSchema>;

export const UpdateStoryboardFrameTextDtoSchema = z.object({
  title: z.string().optional(),
  narration: z.string().optional(),
  mainImagePrompt: z.string().optional(),
  backgroundImagePrompt: z.string().optional(),
  bgmPrompt: z.string().optional(),
});
export type UpdateStoryboardFrameTextDto = z.infer<typeof UpdateStoryboardFrameTextDtoSchema>;

export const RegenerateStoryboardPromptDtoSchema = z.object({
  frameId: z.string().min(1),
  promptType: StoryboardPromptTypeSchema,
});
export type RegenerateStoryboardPromptDto = z.infer<typeof RegenerateStoryboardPromptDtoSchema>;

export const GenerateStoryboardFrameAssetDtoSchema = z.object({
  assetType: StoryboardAssetTypeSchema,
});
export type GenerateStoryboardFrameAssetDto = z.infer<typeof GenerateStoryboardFrameAssetDtoSchema>;

export const AttachStoryboardFrameAssetDtoSchema = z.object({
  assetType: StoryboardAssetTypeSchema,
  url: z.string().min(1),
});
export type AttachStoryboardFrameAssetDto = z.infer<typeof AttachStoryboardFrameAssetDtoSchema>;

export const ReorderStoryboardFrameDtoSchema = z.object({
  direction: z.enum(['up', 'down']),
});
export type ReorderStoryboardFrameDto = z.infer<typeof ReorderStoryboardFrameDtoSchema>;

export const UpdateStoryboardTransitionDtoSchema = z.object({
  transitionTypeAfter: StoryboardTransitionTypeSchema,
  transitionDurationMs: z.number().int().min(0).max(30000).default(1000),
});
export type UpdateStoryboardTransitionDto = z.infer<typeof UpdateStoryboardTransitionDtoSchema>;

export const ExportStoryboardDtoSchema = z.object({
  mode: z.enum(['unified']).default('unified'),
});
export type ExportStoryboardDto = z.infer<typeof ExportStoryboardDtoSchema>;

// Scene DTOs
export const CreateSceneDtoSchema = z.object({
  storyId: z.string().min(1),
  orderIndex: z.number().int().nonnegative(),
  description: z.string().optional(),
  durationMs: z.number().nonnegative().optional(),
  canvasData: z.string().optional(),
  bgmId: z.string().optional(),
  transitionId: z.string().optional(),
  backgroundImagePrompt: z.string().optional(),
  backgroundImageUrl: z.string().optional(),
  bgmPrompt: z.string().optional(),
  bgmUrl: z.string().optional(),
  transitionTypeAfter: StoryboardTransitionTypeSchema.optional(),
  transitionDurationMs: z.number().int().nonnegative().optional(),
});
export type CreateSceneDto = z.infer<typeof CreateSceneDtoSchema>;

export const UpdateSceneDtoSchema = CreateSceneDtoSchema.partial();
export type UpdateSceneDto = z.infer<typeof UpdateSceneDtoSchema>;

// Clip DTOs
export const CreateClipDtoSchema = z.object({
  sceneId: z.string().min(1),
  orderIndex: z.number().int().nonnegative(),
  type: z.enum(['image', 'video', 'text'] as const),
  content: z.string().optional(),
  imageUrl: z.string().optional(),
  videoUrl: z.string().optional(),
  narrationText: z.string().optional(),
  narrationAudioUrl: z.string().optional(),
  durationMs: z.number().nonnegative().optional(),
  mainImagePrompt: z.string().optional(),
});
export type CreateClipDto = z.infer<typeof CreateClipDtoSchema>;

export const UpdateClipDtoSchema = CreateClipDtoSchema.partial();
export type UpdateClipDto = z.infer<typeof UpdateClipDtoSchema>;

// BgmFile DTOs
export const CreateBgmFileDtoSchema = z.object({
  name: z.string().min(1),
  fileUrl: z.string().min(1),
  duration: z.number().nonnegative().optional(),
  tags: z.array(z.string()).default([]),
});
export type CreateBgmFileDto = z.infer<typeof CreateBgmFileDtoSchema>;

export const UpdateBgmFileDtoSchema = CreateBgmFileDtoSchema.partial();
export type UpdateBgmFileDto = z.infer<typeof UpdateBgmFileDtoSchema>;

// CanvasTemplate DTOs
export const CreateCanvasTemplateDtoSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  aspectRatio: z.enum([CanvasAspectRatio['16:9'], CanvasAspectRatio['9:16'], CanvasAspectRatio['1:1'], CanvasAspectRatio['4:5'], CanvasAspectRatio.custom]),
  canvasData: z.string().min(1),
  previewUrl: z.string().optional(),
  tags: z.array(z.string()).default([]),
  isDefault: z.boolean().optional(),
});
export type CreateCanvasTemplateDto = z.infer<typeof CreateCanvasTemplateDtoSchema>;

export const UpdateCanvasTemplateDtoSchema = CreateCanvasTemplateDtoSchema.partial();
export type UpdateCanvasTemplateDto = z.infer<typeof UpdateCanvasTemplateDtoSchema>;

// Strategy DTOs
export const CreateStrategyDtoSchema = z.object({
  productId: z.string().min(1),
  campaignId: z.string().optional(),
  content: z.string().min(1),
  generatedBy: z.string().optional(),
});
export type CreateStrategyDto = z.infer<typeof CreateStrategyDtoSchema>;

export const UpdateStrategyDtoSchema = CreateStrategyDtoSchema.partial();
export type UpdateStrategyDto = z.infer<typeof UpdateStrategyDtoSchema>;
