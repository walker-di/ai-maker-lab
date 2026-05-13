<script lang="ts">
	import { Button } from '$ui/components/ui/button/index.js';
	import { Input } from '$ui/components/ui/input/index.js';
	import { Textarea } from '$ui/components/ui/textarea/index.js';
	import { Label } from '$ui/components/ui/label/index.js';
	import * as Select from '$ui/components/ui/select/index.js';
	import { Slider } from '$ui/components/ui/slider/index.js';
	import AlertCircleIcon from '@lucide/svelte/icons/alert-circle';
	import { createStoryFormModel } from './StoryForm.svelte.js';
	import type { Story } from '../types.js';

	interface Props {
		story?: Story;
		isLoading?: boolean;
		onSubmit: (data: ReturnType<ReturnType<typeof createStoryFormModel>['toInput']>) => void | Promise<void>;
		onCancel?: () => void;
	}

	let { story, isLoading = false, onSubmit, onCancel }: Props = $props();

	const model = createStoryFormModel(story);
	const isEditMode = $derived(!!story);

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

	const selectedLangLabel = $derived(
		langOptions.find((o) => o.value === model.narrationLang)?.label ?? 'English'
	);

	let sliderValue = $state([model.bgmVolume]);
	$effect(() => { model.bgmVolume = sliderValue[0]; });

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!model.validate()) return;
		await onSubmit(model.toInput());
	}
</script>

<form onsubmit={handleSubmit} class="space-y-5" novalidate>
	{#if model.errors.server}
		<div class="flex items-center gap-2 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
			<AlertCircleIcon class="h-4 w-4 shrink-0" />
			{model.errors.server}
		</div>
	{/if}

	<div class="space-y-1">
		<Label for="story-title" class={model.errors.title ? 'text-destructive' : ''}>
			Title <span aria-hidden="true">*</span>
		</Label>
		<Input
			id="story-title"
			type="text"
			bind:value={model.title}
			disabled={isLoading}
			aria-required="true"
			aria-invalid={!!model.errors.title}
			class={model.errors.title ? 'border-destructive' : ''}
			placeholder="e.g., Product Launch Story"
		/>
		{#if model.errors.title}
			<p class="text-sm text-destructive">{model.errors.title}</p>
		{/if}
	</div>

	<div class="space-y-1">
		<Label for="story-description">Description</Label>
		<Textarea
			id="story-description"
			bind:value={model.description}
			disabled={isLoading}
			rows={3}
			placeholder="Brief description of the story…"
		/>
	</div>

	<div class="space-y-1">
		<Label for="story-voice">Narration Voice</Label>
		<Input
			id="story-voice"
			type="text"
			bind:value={model.narrationVoice}
			disabled={isLoading}
			placeholder="e.g., en-US-Neural2-F"
		/>
	</div>

	<div class="space-y-1">
		<Label>Narration Language</Label>
		<Select.Root
			type="single"
			value={model.narrationLang}
			onValueChange={(v) => { model.narrationLang = v; }}
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

	<div class="flex justify-end gap-2 pt-2">
		{#if onCancel}
			<Button type="button" variant="outline" onclick={onCancel} disabled={isLoading}>
				Cancel
			</Button>
		{/if}
		<Button type="submit" disabled={isLoading}>
			{#if isLoading}
				{isEditMode ? 'Saving…' : 'Creating…'}
			{:else}
				{isEditMode ? 'Save Changes' : 'Create Story'}
			{/if}
		</Button>
	</div>
</form>
