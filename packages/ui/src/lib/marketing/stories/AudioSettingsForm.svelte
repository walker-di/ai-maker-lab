<script lang="ts">
	import { Button } from '$ui/components/ui/button/index.js';
	import { Label } from '$ui/components/ui/label/index.js';
	import * as Select from '$ui/components/ui/select/index.js';
	import { Slider } from '$ui/components/ui/slider/index.js';
	import { createAudioSettingsFormModel } from './AudioSettingsForm.svelte.js';
	import type { AudioSettings } from './AudioSettingsForm.svelte.js';

	interface Voice {
		id: string;
		name: string;
		lang: string;
	}

	interface Props {
		settings: AudioSettings;
		voices: Voice[];
		onSave: (settings: AudioSettings) => void | Promise<void>;
		isLoading?: boolean;
	}

	let { settings, voices, onSave, isLoading = false }: Props = $props();

	const model = createAudioSettingsFormModel(settings);

	const langOptions = [
		{ value: 'en', label: 'English' },
		{ value: 'ja', label: 'Japanese' },
		{ value: 'zh', label: 'Chinese' },
		{ value: 'ko', label: 'Korean' },
		{ value: 'es', label: 'Spanish' },
		{ value: 'fr', label: 'French' },
		{ value: 'de', label: 'German' },
		{ value: 'th', label: 'Thai' },
	];

	const filteredVoices = $derived(
		voices.filter((v) => !model.narrationLang || v.lang.startsWith(model.narrationLang))
	);

	const selectedVoiceLabel = $derived(
		voices.find((v) => v.id === model.narrationVoice)?.name ?? 'Select voice…'
	);
	const selectedLangLabel = $derived(
		langOptions.find((o) => o.value === model.narrationLang)?.label ?? 'English'
	);

	let sliderValue = $state([model.bgmVolume]);
	$effect(() => { model.bgmVolume = sliderValue[0]; });

	async function handleSave() {
		await onSave(model.toSettings());
	}
</script>

<div class="space-y-5">
	<div class="space-y-1">
		<Label>Language</Label>
		<Select.Root
			type="single"
			value={model.narrationLang}
			onValueChange={(v) => {
				model.narrationLang = v;
				model.narrationVoice = '';
			}}
			disabled={isLoading}
		>
			<Select.Trigger>
				<span>{selectedLangLabel}</span>
			</Select.Trigger>
			<Select.Content>
				{#each langOptions as opt}
					<Select.Item value={opt.value}>{opt.label}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
	</div>

	{#if filteredVoices.length > 0}
		<div class="space-y-1">
			<Label>Narration Voice</Label>
			<Select.Root
				type="single"
				value={model.narrationVoice}
				onValueChange={(v) => { model.narrationVoice = v; }}
				disabled={isLoading}
			>
				<Select.Trigger>
					<span class={!model.narrationVoice ? 'text-muted-foreground' : ''}>{selectedVoiceLabel}</span>
				</Select.Trigger>
				<Select.Content>
					{#each filteredVoices as v}
						<Select.Item value={v.id}>{v.name}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</div>
	{/if}

	<div class="space-y-2">
		<div class="flex items-center justify-between">
			<Label>BGM Volume</Label>
			<span class="text-muted-foreground text-sm tabular-nums">{sliderValue[0]}%</span>
		</div>
		<Slider
			type="multiple"
			min={0}
			max={100}
			step={1}
			bind:value={sliderValue}
			disabled={isLoading}
			class="w-full"
		/>
	</div>

	<div class="flex justify-end">
		<Button type="button" onclick={handleSave} disabled={isLoading}>
			{isLoading ? 'Saving…' : 'Save Settings'}
		</Button>
	</div>
</div>
