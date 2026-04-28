import type { StoryboardTransitionType } from './storyboard-types.js';

export interface AudioSettings {
  narrationVoice?: string;
  narrationLang?: string;
  bgmId?: string;
  bgmVolume?: number;
}

export interface Story {
  id: string;
  creativeId: string;
  title: string;
  description?: string;
  audioSettings: AudioSettings;
  totalDuration?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Scene {
  id: string;
  storyId: string;
  orderIndex: number;
  description?: string;
  durationMs?: number;
  canvasData?: string;
  bgmId?: string;
  transitionId?: string;
  /** Storyboard Maker metadata: prompt used to generate/select a background image for this frame. */
  backgroundImagePrompt?: string;
  /** Storyboard Maker metadata: generated/selected background image URL for this frame. */
  backgroundImageUrl?: string;
  /** Storyboard Maker metadata: prompt used to generate/select BGM for this frame. */
  bgmPrompt?: string;
  /** Storyboard Maker metadata: generated/selected BGM URL for this frame. */
  bgmUrl?: string;
  /** Storyboard Maker metadata: outgoing transition after this frame. */
  transitionTypeAfter?: StoryboardTransitionType;
  /** Storyboard Maker metadata: outgoing transition duration after this frame. */
  transitionDurationMs?: number;
  createdAt: string;
  updatedAt: string;
}

export type ClipMediaType = 'image' | 'video' | 'text';

export interface Clip {
  id: string;
  sceneId: string;
  orderIndex: number;
  type: ClipMediaType;
  content?: string;
  imageUrl?: string;
  videoUrl?: string;
  narrationText?: string;
  narrationAudioUrl?: string;
  durationMs?: number;
  /** Storyboard Maker metadata: prompt used to generate/select the main frame image. */
  mainImagePrompt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SceneTransition {
  id: string;
  name: string;
  description?: string;
  css?: string;
  settings?: Record<string, unknown>;
  previewUrl?: string;
  createdAt: string;
  updatedAt: string;
}
