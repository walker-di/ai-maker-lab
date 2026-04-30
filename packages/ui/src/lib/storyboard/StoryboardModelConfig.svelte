<script lang="ts">
	import { Badge } from '$ui/components/ui/badge/index.js';
	import { Button } from '$ui/components/ui/button/index.js';
	import { Label } from '$ui/components/ui/label/index.js';
	import * as Select from '$ui/components/ui/select/index.js';
	import { createStoryboardModelConfigModel, type StoryboardModelOption } from './StoryboardModelConfig.svelte.js';
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
		audioModelOptions?: StoryboardModelOption[];
		audioVoiceOptions?: StoryboardModelOption[];
		audioLanguageOptions?: StoryboardModelOption[];
		supportsLocalModelDownload?: boolean;
		downloadSupportMessage?: string;
		recommendedProviderForDownloads?: StoryboardAudioProvider;
		narrationModelStatus?: 'idle' | 'checking' | 'missing' | 'downloading' | 'ready' | 'error';
		onCheckAudioModelLocal?: () => void | Promise<void>;
		onDownloadAudioModel?: () => void | Promise<void>;
		onUseRecommendedDownloadProvider?: (provider: StoryboardAudioProvider) => void | Promise<void>;
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
		audioModelOptions = [],
		audioVoiceOptions = [],
		audioLanguageOptions = [],
		supportsLocalModelDownload = false,
		downloadSupportMessage,
		recommendedProviderForDownloads,
		narrationModelStatus = 'idle',
		onCheckAudioModelLocal,
		onDownloadAudioModel,
		onUseRecommendedDownloadProvider,
		disabled = false,
	}: Props = $props();

	const model = createStoryboardModelConfigModel({
		get textProvider() { return textProvider; },
		get imageProvider() { return imageProvider; },
		get audioProvider() { return audioProvider; },
	});

	type Preset = {
		id: string;
		label: string;
		description: string;
		textProvider: string;
		textModel: string;
		imageProvider: string;
		imageModel: string;
		audioProvider: StoryboardAudioProvider;
	};

	const presets: Preset[] = [
		{
			id: 'balanced',
			label: 'Balanced',
			description: 'Good quality and speed for most workflows.',
			textProvider: 'openai',
			textModel: 'gpt-4o-mini',
			imageProvider: 'openai',
			imageModel: 'gpt-image-1',
			audioProvider: 'azure',
		},
		{
			id: 'quality',
			label: 'Quality first',
			description: 'Higher quality prompts and image generation.',
			textProvider: 'anthropic',
			textModel: 'claude-sonnet-4-20250514',
			imageProvider: 'replicate',
			imageModel: 'black-forest-labs/flux-1.1-pro',
			audioProvider: 'azure',
		},
		{
			id: 'speed',
			label: 'Speed first',
			description: 'Faster drafts with lightweight models.',
			textProvider: 'google',
			textModel: 'gemini-2.5-flash',
			imageProvider: 'replicate',
			imageModel: 'black-forest-labs/flux-schnell',
			audioProvider: 'huggingface-local',
		},
	];

	const activePresetId = $derived.by(() => {
		const found = presets.find((preset) =>
			preset.textProvider === textProvider
			&& preset.textModel === textModel
			&& preset.imageProvider === imageProvider
			&& preset.imageModel === imageModel
			&& preset.audioProvider === audioProvider,
		);
		return found?.id ?? null;
	});

	const selectedTextModelLabel = $derived(
		model.availableTextModels.find((option) => option.value === textModel)?.label
			?? (textModel.length > 0 ? textModel : 'Default'),
	);
	const selectedImageModelLabel = $derived(
		model.availableImageModels.find((option) => option.value === imageModel)?.label
			?? (imageModel.length > 0 ? imageModel : 'Default'),
	);
	const selectedAudioModelLabel = $derived(
		audioModelOptions.find((option) => option.value === audioModel)?.label
			?? (audioModel.length > 0 ? audioModel : 'Default'),
	);
	const canManageLocalModel = $derived(supportsLocalModelDownload && audioModel.length > 0);

	function applyPreset(preset: Preset) {
		onTextProviderChange(preset.textProvider);
		onTextModelChange(preset.textModel);
		onImageProviderChange(preset.imageProvider);
		onImageModelChange(preset.imageModel);
		onAudioProviderChange?.(preset.audioProvider);
	}
</script>

<section class="space-y-4 rounded-xl border bg-card/40 p-4" aria-label="Storyboard model configuration">
	<div class="flex flex-wrap items-start justify-between gap-3">
		<div class="space-y-1">
			<h3 class="text-sm font-semibold">AI configuration</h3>
			<p class="text-xs text-muted-foreground">
				Tune model providers before generating frames and assets.
			</p>
		</div>
		<div class="flex flex-wrap gap-1.5">
			<Badge variant="outline">Text: {selectedTextModelLabel}</Badge>
			<Badge variant="outline">Image: {selectedImageModelLabel}</Badge>
			<Badge variant="outline">Audio: {selectedAudioModelLabel}</Badge>
		</div>
	</div>

	<div class="rounded-lg border bg-background/40 p-3">
		<p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Quick presets</p>
		<div class="grid gap-2 md:grid-cols-3">
			{#each presets as preset (preset.id)}
				<button
					type="button"
					class={`rounded-md border px-3 py-2 text-left transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-60 ${activePresetId === preset.id ? 'border-primary bg-primary/10' : ''}`}
					onclick={() => applyPreset(preset)}
					disabled={disabled}
				>
					<p class="text-sm font-medium">{preset.label}</p>
					<p class="text-xs text-muted-foreground">{preset.description}</p>
				</button>
			{/each}
		</div>
	</div>

	<div class="grid gap-4 lg:grid-cols-3">
		<fieldset class="space-y-3 rounded-lg border p-3" {disabled}>
			<legend class="px-1 text-xs font-medium text-muted-foreground">Text generation</legend>
			<p class="text-xs text-muted-foreground">Used when generating frame prompts and narration text.</p>
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
			<legend class="px-1 text-xs font-medium text-muted-foreground">Image generation</legend>
			<p class="text-xs text-muted-foreground">Used for main image and background image creation.</p>
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
			<legend class="px-1 text-xs font-medium text-muted-foreground">Narration audio</legend>
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
					<Select.Root
						type="single"
						value={audioModel}
						onValueChange={(v) => { if (v) onAudioModelChange?.(v); }}
						{disabled}
					>
						<Select.Trigger id="audio-model" class="w-full" aria-label="Narration audio model">
							{audioModelOptions.find((o) => o.value === audioModel)?.label ?? 'Select model'}
						</Select.Trigger>
						<Select.Content>
							{#each audioModelOptions as opt (opt.value)}
								<Select.Item value={opt.value}>{opt.label}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
				<div class="space-y-1">
					<Label for="audio-voice">Voice</Label>
					<Select.Root
						type="single"
						value={audioVoice}
						onValueChange={(v) => { if (v) onAudioVoiceChange?.(v); }}
						{disabled}
					>
						<Select.Trigger id="audio-voice" class="w-full" aria-label="Narration voice">
							{audioVoiceOptions.find((o) => o.value === audioVoice)?.label ?? 'Select voice'}
						</Select.Trigger>
						<Select.Content>
							{#each audioVoiceOptions as opt (opt.value)}
								<Select.Item value={opt.value}>{opt.label}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
				<div class="space-y-1">
					<Label for="audio-language">Language</Label>
					<Select.Root
						type="single"
						value={audioLanguage}
						onValueChange={(v) => { if (v) onAudioLanguageChange?.(v); }}
						{disabled}
					>
						<Select.Trigger id="audio-language" class="w-full" aria-label="Narration language">
							{audioLanguageOptions.find((o) => o.value === audioLanguage)?.label ?? 'Select language'}
						</Select.Trigger>
						<Select.Content>
							{#each audioLanguageOptions as opt (opt.value)}
								<Select.Item value={opt.value}>{opt.label}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
			</div>
			<div class="mt-3 flex flex-wrap items-center gap-2">
				<Button type="button" variant="outline" size="sm" onclick={() => onCheckAudioModelLocal?.()} disabled={disabled || !canManageLocalModel || narrationModelStatus === 'checking' || narrationModelStatus === 'downloading'}>
					{narrationModelStatus === 'checking' ? 'Checking…' : 'Check local model'}
				</Button>
				<Button type="button" size="sm" onclick={() => onDownloadAudioModel?.()} disabled={disabled || !canManageLocalModel || narrationModelStatus === 'downloading'}>
					{narrationModelStatus === 'downloading' ? 'Downloading…' : 'Download model'}
				</Button>
				{#if !supportsLocalModelDownload}
					<p class="text-xs text-amber-700">{downloadSupportMessage ?? 'This provider does not support local model downloads.'}</p>
					{#if recommendedProviderForDownloads && onUseRecommendedDownloadProvider}
						<Button
							type="button"
							variant="outline"
							size="sm"
							onclick={() => onUseRecommendedDownloadProvider(recommendedProviderForDownloads)}
							disabled={disabled || audioProvider === recommendedProviderForDownloads}
						>
							Use {recommendedProviderForDownloads === 'huggingface-local' ? 'Hugging Face local' : recommendedProviderForDownloads}
						</Button>
					{/if}
				{:else if narrationModelStatus === 'ready'}
					<p class="text-xs text-emerald-600">Model is available locally.</p>
				{:else if narrationModelStatus === 'missing'}
					<p class="text-xs text-amber-600">Model is not local yet.</p>
				{:else if narrationModelStatus === 'error'}
					<p class="text-xs text-destructive">Failed to check or download model.</p>
				{/if}
			</div>
		</fieldset>
	</div>
</section>
