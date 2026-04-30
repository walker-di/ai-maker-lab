<script lang="ts">
	import { Label } from '$ui/components/ui/label/index.js';
	import * as Select from '$ui/components/ui/select/index.js';

	interface ModelOption {
		value: string;
		label: string;
		group?: string;
	}

	interface Props {
		textProvider: string;
		textModel: string;
		imageProvider: string;
		imageModel: string;
		onTextProviderChange: (provider: string) => void;
		onTextModelChange: (model: string) => void;
		onImageProviderChange: (provider: string) => void;
		onImageModelChange: (model: string) => void;
		disabled?: boolean;
	}

	let {
		textProvider,
		textModel,
		imageProvider,
		imageModel,
		onTextProviderChange,
		onTextModelChange,
		onImageProviderChange,
		onImageModelChange,
		disabled = false,
	}: Props = $props();

	const textProviderOptions: ModelOption[] = [
		{ value: 'openai', label: 'OpenAI' },
		{ value: 'anthropic', label: 'Anthropic' },
		{ value: 'google', label: 'Google Gemini' },
	];

	const textModelsByProvider: Record<string, ModelOption[]> = {
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

	const imageProviderOptions: ModelOption[] = [
		{ value: 'openai', label: 'OpenAI' },
		{ value: 'replicate', label: 'Replicate' },
	];

	const imageModelsByProvider: Record<string, ModelOption[]> = {
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

	const availableTextModels = $derived(textModelsByProvider[textProvider] ?? []);
	const availableImageModels = $derived(imageModelsByProvider[imageProvider] ?? []);
</script>

<div class="grid gap-4 sm:grid-cols-2">
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
					{textProviderOptions.find((o) => o.value === textProvider)?.label ?? 'Select provider'}
				</Select.Trigger>
				<Select.Content>
					{#each textProviderOptions as opt (opt.value)}
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
					{availableTextModels.find((o) => o.value === textModel)?.label ?? 'Select model'}
				</Select.Trigger>
				<Select.Content>
					{#each availableTextModels as opt (opt.value)}
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
					{imageProviderOptions.find((o) => o.value === imageProvider)?.label ?? 'Select provider'}
				</Select.Trigger>
				<Select.Content>
					{#each imageProviderOptions as opt (opt.value)}
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
					{availableImageModels.find((o) => o.value === imageModel)?.label ?? 'Select model'}
				</Select.Trigger>
				<Select.Content>
					{#each availableImageModels as opt (opt.value)}
						<Select.Item value={opt.value}>{opt.label}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</div>
	</fieldset>
</div>
