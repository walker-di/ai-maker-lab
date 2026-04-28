<script lang="ts">
	import { Button } from '$ui/components/ui/button/index.js';
	import { Input } from '$ui/components/ui/input/index.js';
	import { Textarea } from '$ui/components/ui/textarea/index.js';
	import { Label } from '$ui/components/ui/label/index.js';
	import * as Select from '$ui/components/ui/select/index.js';
	import AlertCircleIcon from '@lucide/svelte/icons/alert-circle';
	import { createClipFormModel } from './ClipForm.svelte.js';
	import type { Clip, CreateClipInput } from '../types.js';

	interface Props {
		clip?: Clip;
		sceneId: string;
		orderIndex?: number;
		isLoading?: boolean;
		onSubmit: (data: CreateClipInput) => void | Promise<void>;
		onCancel?: () => void;
	}

	let { clip, sceneId, orderIndex = 0, isLoading = false, onSubmit, onCancel }: Props = $props();

	const model = createClipFormModel(clip);
	const isEditMode = $derived(!!clip);

	const typeOptions = [
		{ value: 'text', label: 'Text' },
		{ value: 'image', label: 'Image' },
		{ value: 'video', label: 'Video' },
	] as const;

	const selectedTypeLabel = $derived(
		typeOptions.find((o) => o.value === model.type)?.label ?? 'Select type…'
	);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!model.validate()) return;
		await onSubmit(model.toInput(sceneId, orderIndex));
	}
</script>

<form onsubmit={handleSubmit} class="space-y-4" novalidate>
	{#if model.errors.server}
		<div class="flex items-center gap-2 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
			<AlertCircleIcon class="h-4 w-4 shrink-0" />
			{model.errors.server}
		</div>
	{/if}

	<div class="space-y-1">
		<Label class={model.errors.type ? 'text-destructive' : ''}>
			Type <span aria-hidden="true">*</span>
		</Label>
		<Select.Root
			type="single"
			value={model.type}
			onValueChange={(v) => { model.type = v as typeof model.type; }}
			disabled={isLoading}
		>
			<Select.Trigger class={model.errors.type ? 'border-destructive' : ''}>
				<span class={!model.type ? 'text-muted-foreground' : ''}>{selectedTypeLabel}</span>
			</Select.Trigger>
			<Select.Content>
				{#each typeOptions as opt}
					<Select.Item value={opt.value}>{opt.label}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
		{#if model.errors.type}
			<p class="text-sm text-destructive">{model.errors.type}</p>
		{/if}
	</div>

	<div class="space-y-1">
		<Label for="clip-content">Content</Label>
		<Textarea
			id="clip-content"
			bind:value={model.content}
			disabled={isLoading}
			rows={3}
			placeholder={model.type === 'text' ? 'Enter text content…' : 'URL or reference…'}
		/>
	</div>

	<div class="space-y-1">
		<Label for="clip-narration">Narration Text</Label>
		<Textarea
			id="clip-narration"
			bind:value={model.narrationText}
			disabled={isLoading}
			rows={3}
			placeholder="Text to be narrated for this clip…"
		/>
	</div>

	<div class="space-y-1">
		<Label for="clip-duration" class={model.errors.durationMs ? 'text-destructive' : ''}>
			Duration (ms)
		</Label>
		<Input
			id="clip-duration"
			type="number"
			min="100"
			step="100"
			bind:value={model.durationMs}
			disabled={isLoading}
			class={model.errors.durationMs ? 'border-destructive' : ''}
			placeholder="3000"
		/>
		{#if model.errors.durationMs}
			<p class="text-sm text-destructive">{model.errors.durationMs}</p>
		{/if}
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
				{isEditMode ? 'Save Clip' : 'Add Clip'}
			{/if}
		</Button>
	</div>
</form>
