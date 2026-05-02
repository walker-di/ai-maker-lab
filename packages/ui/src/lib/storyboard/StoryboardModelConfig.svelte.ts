import type { StoryboardAudioProvider, StoryboardNarrationOption } from './types.js';

export type StoryboardModelOption = StoryboardNarrationOption;

export const textProviderOptions: StoryboardModelOption[] = [
	{ value: 'openai', label: 'OpenAI' },
	{ value: 'anthropic', label: 'Anthropic' },
	{ value: 'google', label: 'Google Gemini' },
];

export const textModelsByProvider: Record<string, StoryboardModelOption[]> = {
	openai: [
		{ value: 'gpt-4.1', label: 'GPT-4.1' },
		{ value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
		{ value: 'gpt-4o', label: 'GPT-4o' },
		{ value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
	],
	anthropic: [
		{ value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
		{ value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
	],
	google: [
		{ value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
		{ value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
	],
};

export const imageProviderOptions: StoryboardModelOption[] = [
	{ value: 'openai', label: 'OpenAI' },
	{ value: 'replicate', label: 'Replicate' },
];

export const imageModelsByProvider: Record<string, StoryboardModelOption[]> = {
	openai: [
		{ value: 'gpt-image-1', label: 'GPT Image 1' },
		{ value: 'dall-e-3', label: 'DALL-E 3' },
	],
	replicate: [
		{ value: 'black-forest-labs/flux-1.1-pro', label: 'Flux 1.1 Pro' },
		{ value: 'black-forest-labs/flux-schnell', label: 'Flux Schnell' },
		{ value: 'black-forest-labs/flux-dev', label: 'Flux Dev' },
		{ value: 'stability-ai/sdxl', label: 'SDXL' },
		{ value: 'recraft-ai/recraft-v3', label: 'Recraft V3' },
	],
};

export const audioProviderOptions: Array<StoryboardModelOption & { value: StoryboardAudioProvider }> = [
	{ value: 'azure', label: 'Azure Speech' },
	{ value: 'huggingface-local', label: 'Local models (HF + VibeVoice)' },
];

export function createStoryboardModelConfigModel(input: {
	get textProvider(): string;
	get imageProvider(): string;
	get audioProvider(): StoryboardAudioProvider | undefined;
}) {
	const availableTextModels = $derived(textModelsByProvider[input.textProvider] ?? []);
	const availableImageModels = $derived(imageModelsByProvider[input.imageProvider] ?? []);
	const selectedAudioProviderLabel = $derived(
		audioProviderOptions.find((o) => o.value === (input.audioProvider ?? 'azure'))?.label ?? 'Select provider',
	);

	return {
		textProviderOptions,
		imageProviderOptions,
		audioProviderOptions,
		get availableTextModels() { return availableTextModels; },
		get availableImageModels() { return availableImageModels; },
		get selectedAudioProviderLabel() { return selectedAudioProviderLabel; },
	};
}
