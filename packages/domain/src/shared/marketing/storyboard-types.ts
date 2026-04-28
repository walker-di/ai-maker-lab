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
