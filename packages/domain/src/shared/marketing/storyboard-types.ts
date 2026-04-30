export const STORYBOARD_MAKER_CREATIVE_ID = 'storyboard-maker';

export type StoryboardPromptType = 'narration' | 'mainImage' | 'backgroundImage' | 'bgm';

export type StoryboardAssetType = 'mainImage' | 'backgroundImage' | 'narrationAudio' | 'bgm';

export type StoryboardTransitionType = 'none' | 'fade' | 'slide' | 'wipe' | 'zoom';

export interface StoryboardSummary {
  id: string;
  name: string;
  description?: string;
  frameCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoryboardFrame {
  id: string;
  storyboardId: string;
  sceneId: string;
  clipId?: string;
  orderIndex: number;
  title?: string;
  narration: string;
  mainImagePrompt: string;
  backgroundImagePrompt: string;
  bgmPrompt: string;
  mainImageUrl?: string;
  backgroundImageUrl?: string;
  bgmUrl?: string;
  narrationAudioUrl?: string;
  durationMs?: number;
  transitionTypeAfter: StoryboardTransitionType;
  transitionDurationMs: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoryboardDetail extends StoryboardSummary {
  frames: StoryboardFrame[];
}

export interface GeneratedStoryboardFrameDraft {
  title?: string;
  narration: string;
  mainImagePrompt: string;
  backgroundImagePrompt: string;
  bgmPrompt: string;
  durationMs?: number;
}

export interface StoryboardAssetRef {
  url: string;
  path?: string;
  type: 'image' | 'audio';
}

export interface StoryboardExportResult {
  videoPath: string;
  durationMs: number;
  downloadUrl?: string;
}

export const StoryboardTextModelProvider = {
  OpenAI: 'openai',
  Anthropic: 'anthropic',
  Google: 'google',
} as const;
export type StoryboardTextModelProvider = (typeof StoryboardTextModelProvider)[keyof typeof StoryboardTextModelProvider];

export const StoryboardTextModel = {
  Gpt4o: 'gpt-4o',
  Gpt4oMini: 'gpt-4o-mini',
  Gpt41: 'gpt-4.1',
  Gpt41Mini: 'gpt-4.1-mini',
  Claude4Sonnet: 'claude-sonnet-4-20250514',
  Claude35Haiku: 'claude-3-5-haiku-20241022',
  Gemini25Pro: 'gemini-2.5-pro',
  Gemini25Flash: 'gemini-2.5-flash',
} as const;
export type StoryboardTextModel = (typeof StoryboardTextModel)[keyof typeof StoryboardTextModel];

export const StoryboardImageModelProvider = {
  OpenAI: 'openai',
  Replicate: 'replicate',
} as const;
export type StoryboardImageModelProvider = (typeof StoryboardImageModelProvider)[keyof typeof StoryboardImageModelProvider];

export const StoryboardImageModel = {
  GptImage1: 'gpt-image-1',
  DallE3: 'dall-e-3',
  FluxPro: 'black-forest-labs/flux-1.1-pro',
  FluxSchnell: 'black-forest-labs/flux-schnell',
  FluxDev: 'black-forest-labs/flux-dev',
  Sdxl: 'stability-ai/sdxl',
  RecraftV3: 'recraft-ai/recraft-v3',
} as const;
export type StoryboardImageModel = (typeof StoryboardImageModel)[keyof typeof StoryboardImageModel];

export interface StoryboardModelConfig {
  textProvider?: StoryboardTextModelProvider;
  textModel?: StoryboardTextModel;
  imageProvider?: StoryboardImageModelProvider;
  imageModel?: StoryboardImageModel;
}
