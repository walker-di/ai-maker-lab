<script lang="ts">
	import { Button } from '$ui/components/ui/button/index.js';
	import { Input } from '$ui/components/ui/input/index.js';
	import { Textarea } from '$ui/components/ui/textarea/index.js';
	import { Label } from '$ui/components/ui/label/index.js';
	import * as Select from '$ui/components/ui/select/index.js';
	import AlertCircleIcon from '@lucide/svelte/icons/alert-circle';
	import XIcon from '@lucide/svelte/icons/x';
	import { createCustomerJourneyMapFormModel } from './CustomerJourneyMapForm.svelte.js';
	import type { CustomerJourneyMap, Product, CreateCustomerJourneyMapInput, CustomerJourneyMapStatus } from '../types.js';

	interface Props {
		journeyMap?: CustomerJourneyMap;
		products: Product[];
		isLoading?: boolean;
		onSubmit: (data: CreateCustomerJourneyMapInput) => void | Promise<void>;
		onCancel?: () => void;
	}

	let { journeyMap, products, isLoading = false, onSubmit, onCancel }: Props = $props();

	const getInitialProducts = () => products;
	const getInitialJourneyMap = () => journeyMap;
	const model = createCustomerJourneyMapFormModel(getInitialProducts(), getInitialJourneyMap());
	const isEditMode = $derived(!!journeyMap);

	const statusOptions: { value: CustomerJourneyMapStatus; label: string }[] = [
		{ value: 'draft', label: 'Draft' },
		{ value: 'active', label: 'Active' },
		{ value: 'archived', label: 'Archived' },
	];

	const selectedProductLabel = $derived(
		products.find((p) => p.id === model.productId)?.name ?? 'Select a product…'
	);

	const selectedStatusLabel = $derived(
		statusOptions.find((o) => o.value === model.status)?.label ?? model.status
	);

	let goalInput = $state('');
	let tagInput = $state('');

	function handleTagKeydown(
		e: KeyboardEvent & { currentTarget: HTMLInputElement },
		addFn: (v: string) => void,
		clearFn: () => void
	) {
		if (e.key === 'Enter' || e.key === ',') {
			e.preventDefault();
			addFn(e.currentTarget.value);
			clearFn();
		}
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (goalInput.trim()) { model.addGoal(goalInput); goalInput = ''; }
		if (tagInput.trim()) { model.addTag(tagInput); tagInput = ''; }
		if (!model.validate()) return;
		await onSubmit(model.toCreateInput());
	}
</script>

<form onsubmit={handleSubmit} class="space-y-6" novalidate>
	{#if model.errors.server}
		<div class="flex items-center gap-2 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
			<AlertCircleIcon class="h-4 w-4 shrink-0" />
			{model.errors.server}
		</div>
	{/if}

	<!-- Basic Info -->
	<section class="space-y-4 rounded-lg border p-4">
		<h2 class="text-sm font-semibold">Basic Information</h2>

		<div class="space-y-1">
			<Label for="cjm-name" class={model.errors.name ? 'text-destructive' : ''}>
				Name <span aria-hidden="true">*</span>
			</Label>
			<Input
				id="cjm-name"
				type="text"
				bind:value={model.name}
				disabled={isLoading}
				aria-required="true"
				aria-invalid={!!model.errors.name}
				aria-describedby={model.errors.name ? 'cjm-name-error' : undefined}
				class={model.errors.name ? 'border-destructive' : ''}
				placeholder="e.g., Growth Lead Journey"
			/>
			{#if model.errors.name}
				<p id="cjm-name-error" class="text-sm text-destructive">{model.errors.name}</p>
			{/if}
		</div>

		{#if products.length > 0}
			<div class="space-y-1">
				<Label for="cjm-product" class={model.errors.productId ? 'text-destructive' : ''}>
					Product <span aria-hidden="true">*</span>
				</Label>
				<Select.Root
					type="single"
					value={model.productId}
					onValueChange={(v) => { model.productId = v; }}
					disabled={isLoading}
				>
					<Select.Trigger id="cjm-product">
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
		{/if}

		<div class="space-y-1">
			<Label for="cjm-status">Status</Label>
			<Select.Root
				type="single"
				value={model.status}
				onValueChange={(v) => { model.status = v as CustomerJourneyMapStatus; }}
				disabled={isLoading}
			>
				<Select.Trigger id="cjm-status">
					<span>{selectedStatusLabel}</span>
				</Select.Trigger>
				<Select.Content>
					{#each statusOptions as opt}
						<Select.Item value={opt.value}>{opt.label}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</div>

		<div class="space-y-1">
			<Label for="cjm-description">Description</Label>
			<Textarea
				id="cjm-description"
				bind:value={model.description}
				disabled={isLoading}
				rows={3}
				placeholder="A brief description of this journey map…"
			/>
		</div>

		<div class="space-y-1">
			<Label for="cjm-scenario">Scenario</Label>
			<Textarea
				id="cjm-scenario"
				bind:value={model.scenario}
				disabled={isLoading}
				rows={3}
				placeholder="Describe the scenario this journey map covers…"
			/>
		</div>
	</section>

	<!-- Goals -->
	<section class="space-y-3 rounded-lg border p-4">
		<h2 class="text-sm font-semibold">Goals</h2>
		{#if model.goals.length > 0}
			<div class="flex flex-wrap gap-1.5" role="list" aria-label="Goals">
				{#each model.goals as goal, i}
					<span
						role="listitem"
						class="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
					>
						{goal}
						<button
							type="button"
							onclick={() => model.removeGoal(i)}
							aria-label="Remove goal: {goal}"
							class="hover:text-destructive"
						>
							<XIcon class="h-3 w-3" />
						</button>
					</span>
				{/each}
			</div>
		{/if}
		<Input
			type="text"
			bind:value={goalInput}
			disabled={isLoading}
			placeholder="Type a goal and press Enter…"
			aria-label="Add goal"
			onkeydown={(e) => handleTagKeydown(e, model.addGoal, () => { goalInput = ''; })}
		/>
	</section>

	<!-- Tags -->
	<section class="space-y-3 rounded-lg border p-4">
		<h2 class="text-sm font-semibold">Tags</h2>
		{#if model.tags.length > 0}
			<div class="flex flex-wrap gap-1.5" role="list" aria-label="Tags">
				{#each model.tags as tag, i}
					<span
						role="listitem"
						class="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
					>
						{tag}
						<button
							type="button"
							onclick={() => model.removeTag(i)}
							aria-label="Remove tag: {tag}"
							class="hover:opacity-70"
						>
							<XIcon class="h-3 w-3" />
						</button>
					</span>
				{/each}
			</div>
		{/if}
		<Input
			type="text"
			bind:value={tagInput}
			disabled={isLoading}
			placeholder="Type a tag and press Enter…"
			aria-label="Add tag"
			onkeydown={(e) => handleTagKeydown(e, model.addTag, () => { tagInput = ''; })}
		/>
	</section>

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
				{isEditMode ? 'Save Changes' : 'Create Journey Map'}
			{/if}
		</Button>
	</div>
</form>
