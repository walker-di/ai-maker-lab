<script lang="ts">
	import { Button } from '$ui/components/ui/button/index.js';
	import { Input } from '$ui/components/ui/input/index.js';
	import { Textarea } from '$ui/components/ui/textarea/index.js';
	import { Label } from '$ui/components/ui/label/index.js';
	import * as Select from '$ui/components/ui/select/index.js';
	import AlertCircleIcon from '@lucide/svelte/icons/alert-circle';
	import { createCampaignFormModel } from './CampaignForm.svelte.js';
	import type { Campaign, Product, CreateCampaignInput } from '../types.js';

	interface Props {
		campaign?: Campaign;
		products: Product[];
		isLoading?: boolean;
		onSubmit: (data: CreateCampaignInput) => void | Promise<void>;
		onCancel?: () => void;
	}

	let { campaign, products, isLoading = false, onSubmit, onCancel }: Props = $props();

	const model = createCampaignFormModel(products, campaign);
	const isEditMode = $derived(!!campaign);

	const statusOptions = [
		{ value: 'draft', label: 'Draft' },
		{ value: 'active', label: 'Active' },
		{ value: 'paused', label: 'Paused' },
		{ value: 'completed', label: 'Completed' },
	] as const;

	const selectedProductLabel = $derived(
		products.find((p) => p.id === model.productId)?.name ?? 'Select a product…'
	);

	const selectedStatusLabel = $derived(
		statusOptions.find((o) => o.value === model.status)?.label ?? 'Draft'
	);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!model.validate()) return;
		await onSubmit(model.toCreateInput());
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
		<Label for="campaign-name" class={model.errors.name ? 'text-destructive' : ''}>
			Campaign Name <span aria-hidden="true">*</span>
		</Label>
		<Input
			id="campaign-name"
			type="text"
			bind:value={model.name}
			disabled={isLoading}
			aria-required="true"
			aria-invalid={!!model.errors.name}
			aria-describedby={model.errors.name ? 'campaign-name-error' : undefined}
			class={model.errors.name ? 'border-destructive' : ''}
			placeholder="e.g., Summer Launch 2025"
		/>
		{#if model.errors.name}
			<p id="campaign-name-error" class="text-sm text-destructive">{model.errors.name}</p>
		{/if}
	</div>

	<div class="space-y-1">
		<Label for="campaign-description">Description</Label>
		<Textarea
			id="campaign-description"
			bind:value={model.description}
			disabled={isLoading}
			rows={3}
			placeholder="Brief description of the campaign…"
		/>
	</div>

	<div class="space-y-1">
		<Label for="campaign-product" class={model.errors.productId ? 'text-destructive' : ''}>
			Product <span aria-hidden="true">*</span>
		</Label>
		<Select.Root
			type="single"
			value={model.productId}
			onValueChange={(v) => { model.productId = v; }}
			disabled={isLoading}
		>
			<Select.Trigger id="campaign-product" aria-required="true" class={model.errors.productId ? 'border-destructive' : ''}>
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

	<div class="space-y-1">
		<Label for="campaign-status">Status</Label>
		<Select.Root
			type="single"
			value={model.status}
			onValueChange={(v) => { model.status = v as typeof model.status; }}
			disabled={isLoading}
		>
			<Select.Trigger id="campaign-status">
				<span>{selectedStatusLabel}</span>
			</Select.Trigger>
			<Select.Content>
				{#each statusOptions as opt}
					<Select.Item value={opt.value}>{opt.label}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
	</div>

	<div class="grid gap-4 sm:grid-cols-2">
		<div class="space-y-1">
			<Label for="campaign-start">Start Date</Label>
			<Input
				id="campaign-start"
				type="date"
				bind:value={model.startDate}
				disabled={isLoading}
			/>
		</div>
		<div class="space-y-1">
			<Label for="campaign-end">End Date</Label>
			<Input
				id="campaign-end"
				type="date"
				bind:value={model.endDate}
				disabled={isLoading}
			/>
		</div>
	</div>

	<div class="space-y-1">
		<Label for="campaign-goals" class={model.errors.goals ? 'text-destructive' : ''}>
			Goals <span aria-hidden="true">*</span>
		</Label>
		<Textarea
			id="campaign-goals"
			bind:value={model.goals}
			disabled={isLoading}
			rows={3}
			aria-required="true"
			aria-invalid={!!model.errors.goals}
			aria-describedby={model.errors.goals ? 'campaign-goals-error' : undefined}
			class={model.errors.goals ? 'border-destructive' : ''}
			placeholder="e.g., Increase brand awareness by 20% among 25–34 year olds"
		/>
		{#if model.errors.goals}
			<p id="campaign-goals-error" class="text-sm text-destructive">{model.errors.goals}</p>
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
				{isEditMode ? 'Save Changes' : 'Create Campaign'}
			{/if}
		</Button>
	</div>
</form>
