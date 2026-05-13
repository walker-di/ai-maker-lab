<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle } from '$ui/components/ui/card/index.js';
	import { Button } from '$ui/components/ui/button/index.js';
	import { Badge } from '$ui/components/ui/badge/index.js';
	import EditIcon from '@lucide/svelte/icons/pencil';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import PaletteIcon from '@lucide/svelte/icons/palette';
	import type { Persona } from '../types.js';

	interface Props {
		persona: Persona;
		onEdit?: () => void;
		onDelete?: () => void;
		onViewCreatives?: () => void;
	}

	let { persona, onEdit, onDelete, onViewCreatives }: Props = $props();

	const initials = $derived(
		persona.name
			.split(' ')
			.map((w) => w[0])
			.join('')
			.toUpperCase()
			.slice(0, 2)
	);

	const visibleInterests = $derived(persona.interests.slice(0, 3));
	const extraInterests = $derived(Math.max(0, persona.interests.length - 3));

	const genderLabel: Record<typeof persona.gender, string> = {
		male: 'Male',
		female: 'Female',
		non_binary: 'Non-binary',
		all: 'All',
	};
</script>

<Card class="group relative flex flex-col transition-shadow hover:shadow-md">
	<CardHeader class="pb-2">
		<div class="flex items-start justify-between gap-2">
			<div class="flex items-center gap-3">
				{#if persona.avatarUrl}
					<img
						src={persona.avatarUrl}
						alt={persona.name}
						class="h-10 w-10 rounded-full object-cover"
					/>
				{:else}
					<div
						class="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
						aria-hidden="true"
					>
						{initials}
					</div>
				{/if}
				<div>
					<CardTitle class="text-sm leading-snug">{persona.name}</CardTitle>
					<p class="text-muted-foreground text-xs">
						{persona.age} · {genderLabel[persona.gender]}
					</p>
				</div>
			</div>
			<div class="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
				{#if onEdit}
					<Button
						type="button"
						variant="ghost"
						size="icon"
						class="h-7 w-7"
						onclick={onEdit}
						aria-label="Edit {persona.name}"
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
						aria-label="Delete {persona.name}"
					>
						<TrashIcon class="h-3.5 w-3.5" />
					</Button>
				{/if}
			</div>
		</div>
	</CardHeader>

	<CardContent class="flex flex-1 flex-col gap-3">
		<p class="text-muted-foreground text-xs font-medium">{persona.occupation}</p>

		{#if visibleInterests.length > 0}
			<div class="flex flex-wrap gap-1" aria-label="Interests">
				{#each visibleInterests as interest}
					<Badge variant="secondary" class="text-xs font-normal">{interest}</Badge>
				{/each}
				{#if extraInterests > 0}
					<Badge variant="outline" class="text-xs font-normal">+{extraInterests}</Badge>
				{/if}
			</div>
		{/if}

		{#if persona.painPoints.length > 0}
			<p class="text-muted-foreground line-clamp-2 text-xs">
				<span class="font-medium">Pain:</span>
				{persona.painPoints.slice(0, 2).join(', ')}
			</p>
		{/if}

		{#if onViewCreatives}
			<div class="pt-1">
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
			</div>
		{/if}
	</CardContent>
</Card>
