<script lang="ts">
	import { Button } from '$ui/components/ui/button/index.js';
	import { Badge } from '$ui/components/ui/badge/index.js';
	import { Separator } from '$ui/components/ui/separator/index.js';
	import EditIcon from '@lucide/svelte/icons/pencil';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import UserIcon from '@lucide/svelte/icons/user';
	import type { Persona } from '../types.js';

	interface Props {
		persona: Persona;
		onEdit?: () => void;
		onDelete?: () => void;
		onGenerateCreatives?: () => void;
	}

	let { persona, onEdit, onDelete, onGenerateCreatives }: Props = $props();

	const initials = $derived(
		persona.name
			.split(' ')
			.map((w) => w[0])
			.join('')
			.toUpperCase()
			.slice(0, 2)
	);

	const genderLabel: Record<typeof persona.gender, string> = {
		male: 'Male',
		female: 'Female',
		non_binary: 'Non-binary',
		all: 'All',
	};

	const ageRangeLabel: Record<typeof persona.ageRange, string> = {
		'18-24': '18–24',
		'25-34': '25–34',
		'35-44': '35–44',
		'45-54': '45–54',
		'55-64': '55–64',
		'65+': '65+',
	};

	const createdDate = $derived(new Date(persona.createdAt).toLocaleDateString());
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-start justify-between gap-4">
		<div class="flex items-center gap-4">
			{#if persona.avatarUrl}
				<img
					src={persona.avatarUrl}
					alt={persona.name}
					class="h-16 w-16 rounded-full object-cover"
				/>
			{:else}
				<div
					class="bg-primary/10 text-primary flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-bold"
					aria-hidden="true"
				>
					{initials}
				</div>
			{/if}
			<div>
				<h1 class="text-2xl font-bold">{persona.name}</h1>
				<p class="text-muted-foreground text-sm">{persona.occupation}</p>
				<p class="text-muted-foreground text-xs mt-0.5">Created {createdDate}</p>
			</div>
		</div>
		<div class="flex shrink-0 items-center gap-2">
			{#if onGenerateCreatives}
				<Button type="button" variant="secondary" size="sm" onclick={onGenerateCreatives} class="gap-1.5">
					<SparklesIcon class="h-3.5 w-3.5" />
					Generate Creatives
				</Button>
			{/if}
			{#if onEdit}
				<Button type="button" variant="outline" size="sm" onclick={onEdit} class="gap-1.5">
					<EditIcon class="h-3.5 w-3.5" />
					Edit
				</Button>
			{/if}
			{#if onDelete}
				<Button
					type="button"
					variant="outline"
					size="sm"
					onclick={onDelete}
					class="gap-1.5 text-destructive hover:text-destructive"
				>
					<TrashIcon class="h-3.5 w-3.5" />
					Delete
				</Button>
			{/if}
		</div>
	</div>

	<!-- Demographics -->
	<section>
		<h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Demographics</h2>
		<dl class="grid grid-cols-2 gap-3 sm:grid-cols-4">
			<div>
				<dt class="text-muted-foreground text-xs">Age</dt>
				<dd class="text-sm font-medium">{persona.age}</dd>
			</div>
			<div>
				<dt class="text-muted-foreground text-xs">Age Range</dt>
				<dd class="text-sm font-medium">{ageRangeLabel[persona.ageRange]}</dd>
			</div>
			<div>
				<dt class="text-muted-foreground text-xs">Gender</dt>
				<dd class="text-sm font-medium">{genderLabel[persona.gender]}</dd>
			</div>
			<div>
				<dt class="text-muted-foreground text-xs">Occupation</dt>
				<dd class="text-sm font-medium">{persona.occupation}</dd>
			</div>
		</dl>
	</section>

	<Separator />

	<!-- Description -->
	<section>
		<h2 class="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Description</h2>
		<p class="text-sm leading-relaxed">{persona.description}</p>
	</section>

	<!-- Interests -->
	{#if persona.interests.length > 0}
		<section>
			<h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Interests</h2>
			<div class="flex flex-wrap gap-2" aria-label="Interests">
				{#each persona.interests as interest}
					<Badge variant="secondary" class="font-normal">{interest}</Badge>
				{/each}
			</div>
		</section>
	{/if}

	<!-- Pain Points -->
	{#if persona.painPoints.length > 0}
		<section>
			<h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pain Points</h2>
			<ul class="space-y-1.5" aria-label="Pain points">
				{#each persona.painPoints as point}
					<li class="flex items-start gap-2 text-sm">
						<span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive"></span>
						{point}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<!-- Motivations -->
	{#if persona.motivations.length > 0}
		<section>
			<h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Motivations</h2>
			<ul class="space-y-1.5" aria-label="Motivations">
				{#each persona.motivations as motivation}
					<li class="flex items-start gap-2 text-sm">
						<span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"></span>
						{motivation}
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>
