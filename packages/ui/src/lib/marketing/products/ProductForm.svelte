<script lang="ts">
	import { Button } from '$ui/components/ui/button/index.js';
	import { Input } from '$ui/components/ui/input/index.js';
	import { Textarea } from '$ui/components/ui/textarea/index.js';
	import { Label } from '$ui/components/ui/label/index.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import XIcon from '@lucide/svelte/icons/x';
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import AlertCircleIcon from '@lucide/svelte/icons/alert-circle';
	import { dndzone } from 'svelte-dnd-action';
	import { createProductFormModel } from './ProductForm.svelte.js';
	import type { Product, CreateProductInput, UpdateProductInput } from '../types.js';

	interface Props {
		product?: Product;
		isLoading?: boolean;
		onSubmit: (data: CreateProductInput | UpdateProductInput) => void | Promise<void>;
		onCancel?: () => void;
	}

	let { product, isLoading = false, onSubmit, onCancel }: Props = $props();

	const model = createProductFormModel(product);

	const isEditMode = $derived(!!product);

	type DndItem = { id: string; value: string };

	let featureItems = $state<DndItem[]>(
		(product?.features ?? ['']).map((f, i) => ({ id: `f-${i}`, value: f }))
	);
	let benefitItems = $state<DndItem[]>(
		(product?.benefits ?? ['']).map((b, i) => ({ id: `b-${i}`, value: b }))
	);

	function addFeature() {
		featureItems = [...featureItems, { id: `f-${Date.now()}`, value: '' }];
	}

	function removeFeature(id: string) {
		featureItems = featureItems.filter((f) => f.id !== id);
		if (featureItems.length === 0) addFeature();
	}

	function addBenefit() {
		benefitItems = [...benefitItems, { id: `b-${Date.now()}`, value: '' }];
	}

	function removeBenefit(id: string) {
		benefitItems = benefitItems.filter((b) => b.id !== id);
		if (benefitItems.length === 0) addBenefit();
	}

	function handleFeatureDnd(e: CustomEvent<{ items: DndItem[] }>) {
		featureItems = e.detail.items;
	}

	function handleBenefitDnd(e: CustomEvent<{ items: DndItem[] }>) {
		benefitItems = e.detail.items;
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!model.validate()) return;

		const data = isEditMode ? model.toUpdateInput() : model.toCreateInput();
		data.features = featureItems.map((f) => f.value).filter(Boolean);
		data.benefits = benefitItems.map((b) => b.value).filter(Boolean);

		await onSubmit(data);
	}
</script>

<form onsubmit={handleSubmit} class="space-y-6" novalidate>
	{#if model.errors.server}
		<div class="flex items-center gap-2 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
			<AlertCircleIcon class="h-4 w-4 shrink-0" />
			{model.errors.server}
		</div>
	{/if}

	<div class="space-y-1">
		<Label for="product-name" class={model.errors.name ? 'text-destructive' : ''}>
			Product Name <span aria-hidden="true">*</span>
		</Label>
		<Input
			id="product-name"
			type="text"
			bind:value={model.name}
			disabled={isLoading}
			aria-required="true"
			aria-invalid={!!model.errors.name}
			aria-describedby={model.errors.name ? 'product-name-error' : undefined}
			class={model.errors.name ? 'border-destructive' : ''}
			placeholder="e.g., Summer Sale Video Ad Pack"
		/>
		{#if model.errors.name}
			<p id="product-name-error" class="text-sm text-destructive">{model.errors.name}</p>
		{/if}
	</div>

	<div class="space-y-1">
		<Label for="product-description" class={model.errors.description ? 'text-destructive' : ''}>
			Description <span aria-hidden="true">*</span>
		</Label>
		<Textarea
			id="product-description"
			bind:value={model.description}
			disabled={isLoading}
			rows={4}
			aria-required="true"
			aria-invalid={!!model.errors.description}
			aria-describedby={model.errors.description ? 'product-desc-error' : undefined}
			class={model.errors.description ? 'border-destructive' : ''}
			placeholder="Describe the product and its purpose…"
		/>
		{#if model.errors.description}
			<p id="product-desc-error" class="text-sm text-destructive">{model.errors.description}</p>
		{/if}
	</div>

	<div class="space-y-1">
		<Label for="product-audience" class={model.errors.targetAudience ? 'text-destructive' : ''}>
			Target Audience <span aria-hidden="true">*</span>
		</Label>
		<Input
			id="product-audience"
			type="text"
			bind:value={model.targetAudience}
			disabled={isLoading}
			aria-required="true"
			aria-invalid={!!model.errors.targetAudience}
			aria-describedby={model.errors.targetAudience ? 'product-audience-error' : undefined}
			class={model.errors.targetAudience ? 'border-destructive' : ''}
			placeholder="e.g., Small business owners aged 25-45"
		/>
		{#if model.errors.targetAudience}
			<p id="product-audience-error" class="text-sm text-destructive">{model.errors.targetAudience}</p>
		{/if}
	</div>

	<!-- Features -->
	<fieldset class="space-y-2">
		<legend class="text-sm font-medium">Features</legend>
		<div
			use:dndzone={{ items: featureItems, flipDurationMs: 150 }}
			onconsider={handleFeatureDnd}
			onfinalize={handleFeatureDnd}
			class="space-y-2"
		>
			{#each featureItems as item (item.id)}
				<div class="flex items-center gap-2">
					<span class="text-muted-foreground cursor-grab active:cursor-grabbing" aria-hidden="true">
						<GripVerticalIcon class="h-4 w-4" />
					</span>
					<Input
						type="text"
						value={item.value}
						oninput={(e) => {
							const target = e.currentTarget as HTMLInputElement;
							featureItems = featureItems.map((f) => f.id === item.id ? { ...f, value: target.value } : f);
						}}
						disabled={isLoading}
						placeholder="Feature description"
						aria-label="Feature"
						class="flex-1"
					/>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						class="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
						onclick={() => removeFeature(item.id)}
						aria-label="Remove feature"
					>
						<XIcon class="h-3.5 w-3.5" />
					</Button>
				</div>
			{/each}
		</div>
		<Button
			type="button"
			variant="outline"
			size="sm"
			class="gap-1.5"
			onclick={addFeature}
			disabled={isLoading}
		>
			<PlusIcon class="h-3.5 w-3.5" />
			Add Feature
		</Button>
	</fieldset>

	<!-- Benefits -->
	<fieldset class="space-y-2">
		<legend class="text-sm font-medium">Benefits</legend>
		<div
			use:dndzone={{ items: benefitItems, flipDurationMs: 150 }}
			onconsider={handleBenefitDnd}
			onfinalize={handleBenefitDnd}
			class="space-y-2"
		>
			{#each benefitItems as item (item.id)}
				<div class="flex items-center gap-2">
					<span class="text-muted-foreground cursor-grab active:cursor-grabbing" aria-hidden="true">
						<GripVerticalIcon class="h-4 w-4" />
					</span>
					<Input
						type="text"
						value={item.value}
						oninput={(e) => {
							const target = e.currentTarget as HTMLInputElement;
							benefitItems = benefitItems.map((b) => b.id === item.id ? { ...b, value: target.value } : b);
						}}
						disabled={isLoading}
						placeholder="Benefit description"
						aria-label="Benefit"
						class="flex-1"
					/>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						class="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
						onclick={() => removeBenefit(item.id)}
						aria-label="Remove benefit"
					>
						<XIcon class="h-3.5 w-3.5" />
					</Button>
				</div>
			{/each}
		</div>
		<Button
			type="button"
			variant="outline"
			size="sm"
			class="gap-1.5"
			onclick={addBenefit}
			disabled={isLoading}
		>
			<PlusIcon class="h-3.5 w-3.5" />
			Add Benefit
		</Button>
	</fieldset>

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
				{isEditMode ? 'Save Changes' : 'Create Product'}
			{/if}
		</Button>
	</div>
</form>
