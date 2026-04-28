<script lang="ts">
	import { Button } from '$ui/components/ui/button/index.js';
	import { Input } from '$ui/components/ui/input/index.js';
	import { Textarea } from '$ui/components/ui/textarea/index.js';
	import { Label } from '$ui/components/ui/label/index.js';
	import * as Select from '$ui/components/ui/select/index.js';
	import * as RadioGroup from '$ui/components/ui/radio-group/index.js';
	import AlertCircleIcon from '@lucide/svelte/icons/alert-circle';
	import XIcon from '@lucide/svelte/icons/x';
	import { createPersonaFormModel } from './PersonaForm.svelte.js';
	import type { Persona, Product, CreatePersonaInput, AgeRange, Gender } from '../types.js';

	interface Props {
		persona?: Persona;
		products: Product[];
		isLoading?: boolean;
		onSubmit: (data: CreatePersonaInput) => void | Promise<void>;
		onCancel?: () => void;
	}

	let { persona, products, isLoading = false, onSubmit, onCancel }: Props = $props();

	const model = createPersonaFormModel(products, persona);
	const isEditMode = $derived(!!persona);

	const ageRangeOptions: { value: AgeRange; label: string }[] = [
		{ value: '18-24', label: '18–24' },
		{ value: '25-34', label: '25–34' },
		{ value: '35-44', label: '35–44' },
		{ value: '45-54', label: '45–54' },
		{ value: '55-64', label: '55–64' },
		{ value: '65+', label: '65+' },
	];

	const genderOptions: { value: Gender; label: string }[] = [
		{ value: 'male', label: 'Male' },
		{ value: 'female', label: 'Female' },
		{ value: 'non_binary', label: 'Non-binary' },
		{ value: 'all', label: 'All' },
	];

	const selectedProductLabel = $derived(
		products.find((p) => p.id === model.productId)?.name ?? 'Select a product…'
	);

	const selectedAgeRangeLabel = $derived(
		ageRangeOptions.find((o) => o.value === model.ageRange)?.label ?? model.ageRange
	);

	let interestInput = $state('');
	let painPointInput = $state('');
	let motivationInput = $state('');

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
		if (interestInput.trim()) { model.addInterest(interestInput); interestInput = ''; }
		if (painPointInput.trim()) { model.addPainPoint(painPointInput); painPointInput = ''; }
		if (motivationInput.trim()) { model.addMotivation(motivationInput); motivationInput = ''; }
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
			<Label for="persona-name" class={model.errors.name ? 'text-destructive' : ''}>
				Name <span aria-hidden="true">*</span>
			</Label>
			<Input
				id="persona-name"
				type="text"
				bind:value={model.name}
				disabled={isLoading}
				aria-required="true"
				aria-invalid={!!model.errors.name}
				aria-describedby={model.errors.name ? 'persona-name-error' : undefined}
				class={model.errors.name ? 'border-destructive' : ''}
				placeholder="e.g., Sarah the Entrepreneur"
			/>
			{#if model.errors.name}
				<p id="persona-name-error" class="text-sm text-destructive">{model.errors.name}</p>
			{/if}
		</div>

		{#if products.length > 0}
			<div class="space-y-1">
				<Label for="persona-product">Product (optional)</Label>
				<Select.Root
					type="single"
					value={model.productId}
					onValueChange={(v) => { model.productId = v; }}
					disabled={isLoading}
				>
					<Select.Trigger id="persona-product">
						<span class={!model.productId ? 'text-muted-foreground' : ''}>{selectedProductLabel}</span>
					</Select.Trigger>
					<Select.Content>
						{#each products as p}
							<Select.Item value={p.id}>{p.name}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
		{/if}
	</section>

	<!-- Demographics -->
	<section class="space-y-4 rounded-lg border p-4">
		<h2 class="text-sm font-semibold">Demographics</h2>

		<div class="grid gap-4 sm:grid-cols-2">
			<div class="space-y-1">
				<Label for="persona-age" class={model.errors.age ? 'text-destructive' : ''}>
					Age <span aria-hidden="true">*</span>
				</Label>
				<Input
					id="persona-age"
					type="number"
					min="1"
					max="120"
					bind:value={model.age}
					disabled={isLoading}
					aria-required="true"
					aria-invalid={!!model.errors.age}
					class={model.errors.age ? 'border-destructive' : ''}
				/>
				{#if model.errors.age}
					<p class="text-sm text-destructive">{model.errors.age}</p>
				{/if}
			</div>

			<div class="space-y-1">
				<Label for="persona-age-range">Age Range</Label>
				<Select.Root
					type="single"
					value={model.ageRange}
					onValueChange={(v) => { model.ageRange = v as AgeRange; }}
					disabled={isLoading}
				>
					<Select.Trigger id="persona-age-range">
						<span>{selectedAgeRangeLabel}</span>
					</Select.Trigger>
					<Select.Content>
						{#each ageRangeOptions as opt}
							<Select.Item value={opt.value}>{opt.label}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
		</div>

		<div class="space-y-2">
			<Label>Gender</Label>
			<RadioGroup.Root
				value={model.gender}
				onValueChange={(v) => { model.gender = v as Gender; }}
				class="flex flex-wrap gap-4"
				aria-label="Gender"
			>
				{#each genderOptions as opt}
					<div class="flex items-center gap-2">
						<RadioGroup.Item id="gender-{opt.value}" value={opt.value} disabled={isLoading} />
						<Label for="gender-{opt.value}" class="cursor-pointer font-normal">{opt.label}</Label>
					</div>
				{/each}
			</RadioGroup.Root>
		</div>

		<div class="space-y-1">
			<Label for="persona-occupation" class={model.errors.occupation ? 'text-destructive' : ''}>
				Occupation <span aria-hidden="true">*</span>
			</Label>
			<Input
				id="persona-occupation"
				type="text"
				bind:value={model.occupation}
				disabled={isLoading}
				aria-required="true"
				aria-invalid={!!model.errors.occupation}
				class={model.errors.occupation ? 'border-destructive' : ''}
				placeholder="e.g., Small business owner"
			/>
			{#if model.errors.occupation}
				<p class="text-sm text-destructive">{model.errors.occupation}</p>
			{/if}
		</div>
	</section>

	<!-- Interests -->
	<section class="space-y-3 rounded-lg border p-4">
		<h2 class="text-sm font-semibold">Interests</h2>
		{#if model.interests.length > 0}
			<div class="flex flex-wrap gap-1.5" role="list" aria-label="Interests">
				{#each model.interests as interest, i}
					<span
						role="listitem"
						class="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
					>
						{interest}
						<button
							type="button"
							onclick={() => model.removeInterest(i)}
							aria-label="Remove interest: {interest}"
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
			bind:value={interestInput}
			disabled={isLoading}
			placeholder="Type an interest and press Enter…"
			aria-label="Add interest"
			onkeydown={(e) => handleTagKeydown(e, model.addInterest, () => { interestInput = ''; })}
		/>
	</section>

	<!-- Pain Points -->
	<section class="space-y-3 rounded-lg border p-4">
		<h2 class="text-sm font-semibold">Pain Points</h2>
		{#if model.painPoints.length > 0}
			<div class="flex flex-wrap gap-1.5" role="list" aria-label="Pain points">
				{#each model.painPoints as point, i}
					<span
						role="listitem"
						class="bg-destructive/10 text-destructive inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
					>
						{point}
						<button
							type="button"
							onclick={() => model.removePainPoint(i)}
							aria-label="Remove pain point: {point}"
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
			bind:value={painPointInput}
			disabled={isLoading}
			placeholder="Type a pain point and press Enter…"
			aria-label="Add pain point"
			onkeydown={(e) => handleTagKeydown(e, model.addPainPoint, () => { painPointInput = ''; })}
		/>
	</section>

	<!-- Motivations -->
	<section class="space-y-3 rounded-lg border p-4">
		<h2 class="text-sm font-semibold">Motivations</h2>
		{#if model.motivations.length > 0}
			<div class="flex flex-wrap gap-1.5" role="list" aria-label="Motivations">
				{#each model.motivations as motivation, i}
					<span
						role="listitem"
						class="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
					>
						{motivation}
						<button
							type="button"
							onclick={() => model.removeMotivation(i)}
							aria-label="Remove motivation: {motivation}"
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
			bind:value={motivationInput}
			disabled={isLoading}
			placeholder="Type a motivation and press Enter…"
			aria-label="Add motivation"
			onkeydown={(e) => handleTagKeydown(e, model.addMotivation, () => { motivationInput = ''; })}
		/>
	</section>

	<!-- Description -->
	<div class="space-y-1">
		<Label for="persona-description" class={model.errors.description ? 'text-destructive' : ''}>
			Description <span aria-hidden="true">*</span>
		</Label>
		<Textarea
			id="persona-description"
			bind:value={model.description}
			disabled={isLoading}
			rows={4}
			aria-required="true"
			aria-invalid={!!model.errors.description}
			aria-describedby={model.errors.description ? 'persona-desc-error' : undefined}
			class={model.errors.description ? 'border-destructive' : ''}
			placeholder="A brief narrative about this persona's background and context…"
		/>
		{#if model.errors.description}
			<p id="persona-desc-error" class="text-sm text-destructive">{model.errors.description}</p>
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
				{isEditMode ? 'Save Changes' : 'Create Persona'}
			{/if}
		</Button>
	</div>
</form>
