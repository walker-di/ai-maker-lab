<script lang="ts">
	import { Button } from '$ui/components/ui/button/index.js';
	import { Input } from '$ui/components/ui/input/index.js';
	import { Textarea } from '$ui/components/ui/textarea/index.js';
	import { Label } from '$ui/components/ui/label/index.js';
	import * as Select from '$ui/components/ui/select/index.js';
	import AlertCircleIcon from '@lucide/svelte/icons/alert-circle';
	import XIcon from '@lucide/svelte/icons/x';
	import CreativeTypeSelector from './CreativeTypeSelector.svelte';
	import { createCreativeFormModel } from './CreativeForm.svelte.js';
	import type { Creative, Product, Persona, CreativeType } from '../types.js';

	interface Props {
		creative?: Creative;
		products: Product[];
		personas: Persona[];
		isLoading?: boolean;
		onSubmit: (data: Record<string, unknown>) => void | Promise<void>;
		onCancel?: () => void;
	}

	let { creative, products, personas, isLoading = false, onSubmit, onCancel }: Props = $props();

	const model = createCreativeFormModel(creative);
	const isEditMode = $derived(!!creative);

	const statusOptions = [
		{ value: 'draft', label: 'Draft' },
		{ value: 'active', label: 'Active' },
		{ value: 'paused', label: 'Paused' },
		{ value: 'archived', label: 'Archived' },
	] as const;

	const videoPlatformOptions = ['youtube', 'instagram', 'tiktok', 'twitter', 'facebook', 'line'];
	const videoFormatOptions = ['16:9', '9:16', '1:1', '4:5'];
	const imageStyleOptions = ['photorealistic', 'illustration', 'minimalist', 'bold', 'elegant'];

	const selectedProductLabel = $derived(
		products.find((p) => p.id === model.productId)?.name ?? 'Select a product…'
	);
	const selectedPersonaLabel = $derived(
		model.personaId
			? (personas.find((p) => p.id === model.personaId)?.name ?? 'Select a persona…')
			: 'None'
	);
	const selectedStatusLabel = $derived(
		statusOptions.find((o) => o.value === model.status)?.label ?? 'Draft'
	);

	let tagInput = $state('');

	function addTag() {
		const t = tagInput.trim();
		if (t && !model.tags.includes(t)) {
			model.tags = [...model.tags, t];
		}
		tagInput = '';
	}

	function removeTag(tag: string) {
		model.tags = model.tags.filter((t) => t !== tag);
	}

	function handleTagKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ',') {
			e.preventDefault();
			addTag();
		}
	}

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

	<!-- Type selector -->
	<div class="space-y-1">
		<Label class={model.errors.type ? 'text-destructive' : ''}>
			Creative Type <span aria-hidden="true">*</span>
		</Label>
		<CreativeTypeSelector
			selectedType={model.type as CreativeType | undefined}
			onSelect={(t) => { model.type = t; }}
		/>
		{#if model.errors.type}
			<p class="text-sm text-destructive">{model.errors.type}</p>
		{/if}
	</div>

	<!-- Name -->
	<div class="space-y-1">
		<Label for="creative-name" class={model.errors.name ? 'text-destructive' : ''}>
			Name <span aria-hidden="true">*</span>
		</Label>
		<Input
			id="creative-name"
			type="text"
			bind:value={model.name}
			disabled={isLoading}
			aria-required="true"
			aria-invalid={!!model.errors.name}
			class={model.errors.name ? 'border-destructive' : ''}
			placeholder="e.g., Summer Sale Ad V1"
		/>
		{#if model.errors.name}
			<p class="text-sm text-destructive">{model.errors.name}</p>
		{/if}
	</div>

	<!-- Product -->
	<div class="space-y-1">
		<Label class={model.errors.productId ? 'text-destructive' : ''}>
			Product <span aria-hidden="true">*</span>
		</Label>
		<Select.Root
			type="single"
			value={model.productId}
			onValueChange={(v) => { model.productId = v; }}
			disabled={isLoading}
		>
			<Select.Trigger class={model.errors.productId ? 'border-destructive' : ''}>
				<span class={!model.productId ? 'text-muted-foreground' : ''}>{selectedProductLabel}</span>
			</Select.Trigger>
			<Select.Content>
				{#each products as p}
					<Select.Item value={p.id}>{p.name}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
		{#if model.errors.productId}
			<p class="text-sm text-destructive">{model.errors.productId}</p>
		{/if}
	</div>

	<!-- Persona (optional) -->
	<div class="space-y-1">
		<Label>Persona (optional)</Label>
		<Select.Root
			type="single"
			value={model.personaId}
			onValueChange={(v) => { model.personaId = v; }}
			disabled={isLoading}
		>
			<Select.Trigger>
				<span class={!model.personaId ? 'text-muted-foreground' : ''}>{selectedPersonaLabel}</span>
			</Select.Trigger>
			<Select.Content>
				<Select.Item value="">None</Select.Item>
				{#each personas as p}
					<Select.Item value={p.id}>{p.name}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
	</div>

	<!-- Status -->
	<div class="space-y-1">
		<Label>Status</Label>
		<Select.Root
			type="single"
			value={model.status}
			onValueChange={(v) => { model.status = v; }}
			disabled={isLoading}
		>
			<Select.Trigger>
				<span>{selectedStatusLabel}</span>
			</Select.Trigger>
			<Select.Content>
				{#each statusOptions as opt}
					<Select.Item value={opt.value}>{opt.label}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
	</div>

	<!-- Tags -->
	<div class="space-y-1">
		<Label for="creative-tags">Tags</Label>
		<div class="flex gap-2">
			<Input
				id="creative-tags"
				type="text"
				bind:value={tagInput}
				disabled={isLoading}
				placeholder="Add tag, press Enter"
				onkeydown={handleTagKeydown}
				class="flex-1"
			/>
			<Button type="button" variant="outline" onclick={addTag} disabled={isLoading}>Add</Button>
		</div>
		{#if model.tags.length > 0}
			<div class="flex flex-wrap gap-1 pt-1">
				{#each model.tags as tag}
					<span class="bg-secondary text-secondary-foreground flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs">
						{tag}
						<button
							type="button"
							onclick={() => removeTag(tag)}
							class="hover:text-destructive"
							aria-label="Remove tag {tag}"
						>
							<XIcon class="h-3 w-3" />
						</button>
					</span>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Per-type sub-fields -->
	{#if model.type === 'text'}
		<fieldset class="space-y-3 rounded-lg border p-4">
			<legend class="px-1 text-sm font-semibold">Text Details</legend>
			<div class="space-y-1">
				<Label for="creative-tone">Tone</Label>
				<Input
					id="creative-tone"
					type="text"
					bind:value={model.tone}
					disabled={isLoading}
					placeholder="e.g., Friendly, Professional, Urgent"
				/>
			</div>
			<div class="space-y-1">
				<Label for="creative-cta">Call to Action</Label>
				<Input
					id="creative-cta"
					type="text"
					bind:value={model.callToAction}
					disabled={isLoading}
					placeholder="e.g., Buy Now, Learn More"
				/>
			</div>
		</fieldset>
	{:else if model.type === 'video'}
		<fieldset class="space-y-3 rounded-lg border p-4">
			<legend class="px-1 text-sm font-semibold">Video Details</legend>
			<div class="grid gap-3 sm:grid-cols-2">
				<div class="space-y-1">
					<Label>Platform</Label>
					<Select.Root
						type="single"
						value={model.platform}
						onValueChange={(v) => { model.platform = v; }}
						disabled={isLoading}
					>
						<Select.Trigger>
							<span class={!model.platform ? 'text-muted-foreground' : ''}>
								{model.platform || 'Select platform…'}
							</span>
						</Select.Trigger>
						<Select.Content>
							{#each videoPlatformOptions as opt}
								<Select.Item value={opt}>{opt}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
				<div class="space-y-1">
					<Label>Format</Label>
					<Select.Root
						type="single"
						value={model.format}
						onValueChange={(v) => { model.format = v; }}
						disabled={isLoading}
					>
						<Select.Trigger>
							<span class={!model.format ? 'text-muted-foreground' : ''}>
								{model.format || 'Select format…'}
							</span>
						</Select.Trigger>
						<Select.Content>
							{#each videoFormatOptions as opt}
								<Select.Item value={opt}>{opt}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
			</div>
			<div class="space-y-1">
				<Label for="creative-duration">Duration (seconds)</Label>
				<Input
					id="creative-duration"
					type="number"
					min="1"
					bind:value={model.durationSeconds}
					disabled={isLoading}
					placeholder="e.g., 30"
				/>
			</div>
		</fieldset>
	{:else if model.type === 'image'}
		<fieldset class="space-y-3 rounded-lg border p-4">
			<legend class="px-1 text-sm font-semibold">Image Details</legend>
			<div class="space-y-1">
				<Label>Style</Label>
				<Select.Root
					type="single"
					value={model.imageStyle}
					onValueChange={(v) => { model.imageStyle = v; }}
					disabled={isLoading}
				>
					<Select.Trigger>
						<span class={!model.imageStyle ? 'text-muted-foreground' : ''}>
							{model.imageStyle || 'Select style…'}
						</span>
					</Select.Trigger>
					<Select.Content>
						{#each imageStyleOptions as opt}
							<Select.Item value={opt} class="capitalize">{opt}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
		</fieldset>
	{/if}

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
				{isEditMode ? 'Save Changes' : 'Create Creative'}
			{/if}
		</Button>
	</div>
</form>
