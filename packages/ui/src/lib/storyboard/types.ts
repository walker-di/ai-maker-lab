export type StoryboardPromptType = 'narration' | 'mainImage' | 'backgroundImage' | 'bgm';
export type StoryboardAssetType = 'mainImage' | 'backgroundImage' | 'narrationAudio' | 'bgm';
export type StoryboardTransitionType = 'none' | 'fade' | 'slide' | 'wipe' | 'zoom';
export type StoryboardViewMode = 'timeline' | 'grid' | 'preview';

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

export type StoryboardAudioProvider = 'azure' | 'huggingface-local' | 'vibevoice-local';

export interface StoryboardModelConfigState {
	textProvider: string;
	textModel: string;
	imageProvider: string;
	imageModel: string;
	audioProvider?: StoryboardAudioProvider;
	audioModel?: string;
	audioVoice?: string;
	audioLanguage?: string;
}

export interface StoryboardAssetRef {
	url: string;
	path?: string;
	type: 'image' | 'audio';
}
