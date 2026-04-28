<script lang="ts">
	import { Button } from '$ui/components/ui/button/index.js';
	import { Badge } from '$ui/components/ui/badge/index.js';
	import { Separator } from '$ui/components/ui/separator/index.js';
	import EditIcon from '@lucide/svelte/icons/pencil';
	import UsersIcon from '@lucide/svelte/icons/users';
	import PaletteIcon from '@lucide/svelte/icons/palette';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import type { Product } from '../types.js';

	interface Props {
		product: Product;
		personaCount?: number;
		creativeCount?: number;
		onEdit?: () => void;
		onGeneratePersonas?: () => void;
		onViewPersonas?: () => void;
		onViewCreatives?: () => void;
	}

	let {
		product,
		personaCount,
		creativeCount,
		onEdit,
		onGeneratePersonas,
		onViewPersonas,
		onViewCreatives,
	}: Props = $props();

	const createdDate = $derived(new Date(product.createdAt).toLocaleDateString());
	const updatedDate = $derived(new Date(product.updatedAt).toLocaleDateString());
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-start justify-between gap-4">
		<div class="flex items-center gap-4">
			{#if product.imageUrl}
				<img
					src={product.imageUrl}
					alt={product.name}
					class="h-16 w-16 rounded-lg object-cover"
				/>
			{/if}
			<div>
				<h1 class="text-2xl font-bold">{product.name}</h1>
				<p class="text-muted-foreground text-sm">Created {createdDate}</p>
			</div>
		</div>
		{#if onEdit}
			<Button type="button" variant="outline" size="sm" onclick={onEdit} class="gap-1.5 shrink-0">
				<EditIcon class="h-3.5 w-3.5" />
				Edit
			</Button>
		{/if}
	</div>

	<!-- Stats -->
	<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
		<div class="rounded-lg border p-3 text-center">
			<p class="text-2xl font-bold">{product.features.length}</p>
			<p class="text-muted-foreground text-xs">Features</p>
		</div>
		<div class="rounded-lg border p-3 text-center">
			<p class="text-2xl font-bold">{product.benefits.length}</p>
			<p class="text-muted-foreground text-xs">Benefits</p>
		</div>
		{#if personaCount !== undefined}
			<div class="rounded-lg border p-3 text-center">
				<p class="text-2xl font-bold">{personaCount}</p>
				<p class="text-muted-foreground text-xs">Personas</p>
			</div>
		{/if}
		{#if creativeCount !== undefined}
			<div class="rounded-lg border p-3 text-center">
				<p class="text-2xl font-bold">{creativeCount}</p>
				<p class="text-muted-foreground text-xs">Creatives</p>
			</div>
		{/if}
	</div>

	<!-- Actions -->
	{#if onGeneratePersonas || onViewPersonas || onViewCreatives}
		<div class="flex flex-wrap gap-2">
			{#if onGeneratePersonas}
				<Button type="button" variant="secondary" size="sm" onclick={onGeneratePersonas} class="gap-1.5">
					<SparklesIcon class="h-3.5 w-3.5" />
					Generate Personas
				</Button>
			{/if}
			{#if onViewPersonas}
				<Button type="button" variant="outline" size="sm" onclick={onViewPersonas} class="gap-1.5">
					<UsersIcon class="h-3.5 w-3.5" />
					View Personas
				</Button>
			{/if}
			{#if onViewCreatives}
				<Button type="button" variant="outline" size="sm" onclick={onViewCreatives} class="gap-1.5">
					<PaletteIcon class="h-3.5 w-3.5" />
					View Creatives
				</Button>
			{/if}
		</div>
	{/if}

	<Separator />

	<!-- Description -->
	<section>
		<h2 class="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Description</h2>
		<p class="text-sm leading-relaxed">{product.description}</p>
	</section>

	<!-- Target Audience -->
	<section>
		<h2 class="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Target Audience</h2>
		<p class="text-sm leading-relaxed">{product.targetAudience}</p>
	</section>

	<!-- Features -->
	{#if product.features.length > 0}
		<section>
			<h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Features</h2>
			<ul class="space-y-1.5" aria-label="Product features">
				{#each product.features as feature}
					<li class="flex items-start gap-2 text-sm">
						<span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"></span>
						{feature}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<!-- Benefits -->
	{#if product.benefits.length > 0}
		<section>
			<h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Benefits</h2>
			<div class="flex flex-wrap gap-2" aria-label="Product benefits">
				{#each product.benefits as benefit}
					<Badge variant="secondary" class="text-sm font-normal">{benefit}</Badge>
				{/each}
			</div>
		</section>
	{/if}

	<Separator />

	<p class="text-muted-foreground text-xs">Last updated {updatedDate}</p>
</div>
