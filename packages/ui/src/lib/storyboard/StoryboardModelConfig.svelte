<script lang="ts">
	import { Input } from '$ui/components/ui/input/index.js';
	import { Label } from '$ui/components/ui/label/index.js';
	import * as Select from '$ui/components/ui/select/index.js';
	import { createStoryboardModelConfigModel } from './StoryboardModelConfig.svelte.js';
	import type { StoryboardAudioProvider } from './types.js';

	interface Props {
		textProvider: string;
		textModel: string;
		imageProvider: string;
		imageModel: string;
		audioProvider?: StoryboardAudioProvider;
		audioModel?: string;
		audioVoice?: string;
		audioLanguage?: string;
		onTextProviderChange: (provider: string) => void;
		onTextModelChange: (model: string) => void;
		onImageProviderChange: (provider: string) => void;
		onImageModelChange: (model: string) => void;
		onAudioProviderChange?: (provider: StoryboardAudioProvider) => void;
		onAudioModelChange?: (model: string) => void;
		onAudioVoiceChange?: (voice: string) => void;
		onAudioLanguageChange?: (language: string) => void;
		disabled?: boolean;
	}

	let {
		textProvider,
		textModel,
		imageProvider,
		imageModel,
		audioProvider = 'azure',
		audioModel = '',
		audioVoice = '',
		audioLanguage = '',
		onTextProviderChange,
		onTextModelChange,
		onImageProviderChange,
		onImageModelChange,
		onAudioProviderChange,
		onAudioModelChange,
		onAudioVoiceChange,
		onAudioLanguageChange,
		disabled = false,
	}: Props = $props();

	const model = createStoryboardModelConfigModel({
		get textProvider() { return textProvider; },
		get imageProvider() { return imageProvider; },
		get audioProvider() { return audioProvider; },
	});
</script>

<div class="grid gap-4 lg:grid-cols-3">
	<fieldset class="space-y-3 rounded-lg border p-3" {disabled}>
		<legend class="px-1 text-xs font-medium text-muted-foreground">Text Generation (AI prompts)</legend>
		<div class="space-y-1">
			<Label for="text-provider">Provider</Label>
			<Select.Root
				type="single"
				value={textProvider}
				onValueChange={(v) => { if (v) onTextProviderChange(v); }}
				{disabled}
			>
				<Select.Trigger id="text-provider" class="w-full">
					{model.textProviderOptions.find((o) => o.value === textProvider)?.label ?? 'Select provider'}
				</Select.Trigger>
				<Select.Content>
					{#each model.textProviderOptions as opt (opt.value)}
						<Select.Item value={opt.value}>{opt.label}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</div>
		<div class="space-y-1">
			<Label for="text-model">Model</Label>
			<Select.Root
				type="single"
				value={textModel}
				onValueChange={(v) => { if (v) onTextModelChange(v); }}
				{disabled}
			>
				<Select.Trigger id="text-model" class="w-full">
					{model.availableTextModels.find((o) => o.value === textModel)?.label ?? 'Select model'}
				</Select.Trigger>
				<Select.Content>
					{#each model.availableTextModels as opt (opt.value)}
						<Select.Item value={opt.value}>{opt.label}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</div>
	</fieldset>

	<fieldset class="space-y-3 rounded-lg border p-3" {disabled}>
		<legend class="px-1 text-xs font-medium text-muted-foreground">Image Generation</legend>
		<div class="space-y-1">
			<Label for="image-provider">Provider</Label>
			<Select.Root
				type="single"
				value={imageProvider}
				onValueChange={(v) => { if (v) onImageProviderChange(v); }}
				{disabled}
			>
				<Select.Trigger id="image-provider" class="w-full">
					{model.imageProviderOptions.find((o) => o.value === imageProvider)?.label ?? 'Select provider'}
				</Select.Trigger>
				<Select.Content>
					{#each model.imageProviderOptions as opt (opt.value)}
						<Select.Item value={opt.value}>{opt.label}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</div>
		<div class="space-y-1">
			<Label for="image-model">Model</Label>
			<Select.Root
				type="single"
				value={imageModel}
				onValueChange={(v) => { if (v) onImageModelChange(v); }}
				{disabled}
			>
				<Select.Trigger id="image-model" class="w-full">
					{model.availableImageModels.find((o) => o.value === imageModel)?.label ?? 'Select model'}
				</Select.Trigger>
				<Select.Content>
					{#each model.availableImageModels as opt (opt.value)}
						<Select.Item value={opt.value}>{opt.label}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</div>
	</fieldset>

	<fieldset class="space-y-3 rounded-lg border p-3" {disabled} aria-describedby="audio-config-help">
		<legend class="px-1 text-xs font-medium text-muted-foreground">Narration Audio</legend>
		<p id="audio-config-help" class="text-xs text-muted-foreground">
			Generate narration with the selected speech provider. Leave model, voice, or language blank to use server defaults.
		</p>
		<div class="space-y-1">
			<Label for="audio-provider">Provider</Label>
			<Select.Root
				type="single"
				value={audioProvider}
				onValueChange={(v) => { if (v) onAudioProviderChange?.(v as StoryboardAudioProvider); }}
				{disabled}
			>
				<Select.Trigger id="audio-provider" class="w-full" aria-label="Narration audio provider">
					{model.selectedAudioProviderLabel}
				</Select.Trigger>
				<Select.Content>
					{#each model.audioProviderOptions as opt (opt.value)}
						<Select.Item value={opt.value}>{opt.label}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</div>
		<div class="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
			<div class="space-y-1">
				<Label for="audio-model">Audio model</Label>
				<Input
					id="audio-model"
					value={audioModel}
					oninput={(event) => onAudioModelChange?.(event.currentTarget.value)}
					placeholder="Server default"
					aria-label="Narration audio model"
					{disabled}
				/>
			</div>
			<div class="space-y-1">
				<Label for="audio-voice">Voice</Label>
				<Input
					id="audio-voice"
					value={audioVoice}
					oninput={(event) => onAudioVoiceChange?.(event.currentTarget.value)}
					placeholder="Server default"
					aria-label="Narration voice"
					{disabled}
				/>
			</div>
			<div class="space-y-1">
				<Label for="audio-language">Language</Label>
				<Input
					id="audio-language"
					value={audioLanguage}
					oninput={(event) => onAudioLanguageChange?.(event.currentTarget.value)}
					placeholder="Server default"
					aria-label="Narration language"
					{disabled}
				/>
			</div>
		</div>
	</fieldset>
</div>
