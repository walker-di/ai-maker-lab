<script lang="ts">
	import { Button } from '$ui/components/ui/button/index.js';
	import { Badge } from '$ui/components/ui/badge/index.js';
	import { Separator } from '$ui/components/ui/separator/index.js';
	import EditIcon from '@lucide/svelte/icons/pencil';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import BookOpenIcon from '@lucide/svelte/icons/book-open';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import ImageIcon from '@lucide/svelte/icons/image';
	import VideoIcon from '@lucide/svelte/icons/video';
	import LayoutIcon from '@lucide/svelte/icons/layout';
	import type { Creative, CreativeType } from '../types.js';

	interface Props {
		creative: Creative;
		storyCount?: number;
		onEdit?: () => void;
		onDelete?: () => void;
		onViewStories?: () => void;
		onGenerateStory?: () => void;
	}

	let { creative, storyCount = 0, onEdit, onDelete, onViewStories, onGenerateStory }: Props = $props();

	const typeIconMap: Record<CreativeType, typeof FileTextIcon> = {
		text: FileTextIcon,
		image: ImageIcon,
		video: VideoIcon,
		landing_page: LayoutIcon,
	};

	const typeLabelMap: Record<CreativeType, string> = {
		text: 'Text',
		image: 'Image',
		video: 'Video',
		landing_page: 'Landing Page',
	};

	const TypeIcon = $derived(typeIconMap[creative.type]);

	const formattedDate = $derived(
		new Date(creative.createdAt).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		})
	);
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
		<div class="flex items-center gap-3">
			<div class="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
				<TypeIcon class="h-5 w-5 text-muted-foreground" />
			</div>
			<div>
				<h2 class="text-xl font-semibold leading-tight">{creative.name}</h2>
				<div class="mt-1 flex items-center gap-2">
					<Badge variant="outline" class="text-xs">{typeLabelMap[creative.type]}</Badge>
					<Badge
						variant={creative.status === 'active' ? 'default' : 'secondary'}
						class="text-xs capitalize"
					>
						{creative.status}
					</Badge>
				</div>
			</div>
		</div>
		<div class="flex shrink-0 items-center gap-2">
			{#if onGenerateStory}
				<Button type="button" variant="outline" size="sm" onclick={onGenerateStory}>
					<SparklesIcon class="mr-1.5 h-3.5 w-3.5" />
					Generate Story
				</Button>
			{/if}
			{#if onViewStories}
				<Button type="button" variant="outline" size="sm" onclick={onViewStories}>
					<BookOpenIcon class="mr-1.5 h-3.5 w-3.5" />
					Stories ({storyCount})
				</Button>
			{/if}
			{#if onEdit}
				<Button type="button" variant="outline" size="sm" onclick={onEdit}>
					<EditIcon class="mr-1.5 h-3.5 w-3.5" />
					Edit
				</Button>
			{/if}
			{#if onDelete}
				<Button
					type="button"
					variant="outline"
					size="sm"
					onclick={onDelete}
					class="text-destructive hover:text-destructive"
				>
					<TrashIcon class="mr-1.5 h-3.5 w-3.5" />
					Delete
				</Button>
			{/if}
		</div>
	</div>

	<Separator />

	<!-- Details -->
	<dl class="grid gap-4 sm:grid-cols-2">
		<div>
			<dt class="text-muted-foreground text-sm font-medium">Product</dt>
			<dd class="mt-1 text-sm">{creative.productId}</dd>
		</div>
		{#if creative.personaId}
			<div>
				<dt class="text-muted-foreground text-sm font-medium">Persona</dt>
				<dd class="mt-1 text-sm">{creative.personaId}</dd>
			</div>
		{/if}
		<div>
			<dt class="text-muted-foreground text-sm font-medium">Created</dt>
			<dd class="mt-1 text-sm">{formattedDate}</dd>
		</div>
		{#if creative.tags.length > 0}
			<div class="sm:col-span-2">
				<dt class="text-muted-foreground text-sm font-medium">Tags</dt>
				<dd class="mt-1 flex flex-wrap gap-1">
					{#each creative.tags as tag}
						<Badge variant="secondary" class="text-xs font-normal">{tag}</Badge>
					{/each}
				</dd>
			</div>
		{/if}
	</dl>
</div>
