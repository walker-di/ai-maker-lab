<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle } from '$ui/components/ui/card/index.js';
	import { Button } from '$ui/components/ui/button/index.js';
	import { Badge } from '$ui/components/ui/badge/index.js';
	import EditIcon from '@lucide/svelte/icons/pencil';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import UsersIcon from '@lucide/svelte/icons/users';
	import PaletteIcon from '@lucide/svelte/icons/palette';
	import type { Product } from '../types.js';

	interface Props {
		product: Product;
		personaCount?: number;
		onEdit?: () => void;
		onDelete?: () => void;
		onViewPersonas?: () => void;
		onViewCreatives?: () => void;
	}

	let {
		product,
		personaCount,
		onEdit,
		onDelete,
		onViewPersonas,
		onViewCreatives,
	}: Props = $props();

	const truncatedDescription = $derived(
		product.description.length > 120
			? product.description.slice(0, 120) + '…'
			: product.description
	);
</script>

<Card class="group relative flex flex-col transition-shadow hover:shadow-md">
	{#if product.imageUrl}
		<div class="aspect-video overflow-hidden rounded-t-lg bg-muted">
			<img
				src={product.imageUrl}
				alt={product.name}
				class="h-full w-full object-cover"
			/>
		</div>
	{/if}

	<CardHeader class="pb-2">
		<div class="flex items-start justify-between gap-2">
			<CardTitle class="text-base leading-snug">{product.name}</CardTitle>
			<div class="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
				{#if onEdit}
					<Button
						type="button"
						variant="ghost"
						size="icon"
						class="h-7 w-7"
						onclick={onEdit}
						aria-label="Edit {product.name}"
					>
						<EditIcon class="h-3.5 w-3.5" />
					</Button>
				{/if}
				{#if onDelete}
					<Button
						type="button"
						variant="ghost"
						size="icon"
						class="h-7 w-7 text-destructive hover:text-destructive"
						onclick={onDelete}
						aria-label="Delete {product.name}"
					>
						<TrashIcon class="h-3.5 w-3.5" />
					</Button>
				{/if}
			</div>
		</div>
	</CardHeader>

	<CardContent class="flex flex-1 flex-col gap-3">
		<p class="text-muted-foreground text-sm leading-relaxed">{truncatedDescription}</p>

		<div class="flex flex-wrap gap-1.5">
			{#if product.features.length > 0}
				<Badge variant="secondary" class="text-xs">
					{product.features.length} feature{product.features.length !== 1 ? 's' : ''}
				</Badge>
			{/if}
			{#if product.benefits.length > 0}
				<Badge variant="outline" class="text-xs">
					{product.benefits.length} benefit{product.benefits.length !== 1 ? 's' : ''}
				</Badge>
			{/if}
		</div>

		{#if onViewPersonas || onViewCreatives}
			<div class="flex gap-2 pt-1">
				{#if onViewPersonas}
					<Button
						type="button"
						variant="ghost"
						size="sm"
						class="h-7 gap-1.5 px-2 text-xs"
						onclick={onViewPersonas}
					>
						<UsersIcon class="h-3 w-3" />
						{personaCount !== undefined ? `${personaCount} Persona${personaCount !== 1 ? 's' : ''}` : 'Personas'}
					</Button>
				{/if}
				{#if onViewCreatives}
					<Button
						type="button"
						variant="ghost"
						size="sm"
						class="h-7 gap-1.5 px-2 text-xs"
						onclick={onViewCreatives}
					>
						<PaletteIcon class="h-3 w-3" />
						Creatives
					</Button>
				{/if}
			</div>
		{/if}
	</CardContent>
</Card>
