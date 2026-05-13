<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle } from '$ui/components/ui/card/index.js';
	import { Button } from '$ui/components/ui/button/index.js';
	import { Badge } from '$ui/components/ui/badge/index.js';
	import EditIcon from '@lucide/svelte/icons/pencil';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import BookOpenIcon from '@lucide/svelte/icons/book-open';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import ImageIcon from '@lucide/svelte/icons/image';
	import VideoIcon from '@lucide/svelte/icons/video';
	import LayoutIcon from '@lucide/svelte/icons/layout';
	import type { Creative, CreativeType } from '../types.js';

	interface Props {
		creative: Creative;
		onEdit?: () => void;
		onDelete?: () => void;
		onViewStories?: () => void;
	}

	let { creative, onEdit, onDelete, onViewStories }: Props = $props();

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
	const visibleTags = $derived(creative.tags.slice(0, 3));
	const extraTags = $derived(Math.max(0, creative.tags.length - 3));
</script>

<Card class="group relative flex flex-col transition-shadow hover:shadow-md">
	<CardHeader class="pb-2">
		<div class="flex items-start justify-between gap-2">
			<div class="flex items-center gap-2 min-w-0">
				<div class="bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
					<TypeIcon class="h-4 w-4 text-muted-foreground" />
				</div>
				<div class="min-w-0">
					<CardTitle class="truncate text-sm leading-snug">{creative.name}</CardTitle>
					<Badge variant="outline" class="mt-0.5 text-xs font-normal">
						{typeLabelMap[creative.type]}
					</Badge>
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
						aria-label="Edit {creative.name}"
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
						aria-label="Delete {creative.name}"
					>
						<TrashIcon class="h-3.5 w-3.5" />
					</Button>
				{/if}
			</div>
		</div>
	</CardHeader>

	<CardContent class="flex flex-1 flex-col gap-2">
		<div class="flex items-center gap-1.5">
			<span class="text-muted-foreground text-xs">Status:</span>
			<Badge
				variant={creative.status === 'active' ? 'default' : 'secondary'}
				class="text-xs font-normal capitalize"
			>
				{creative.status}
			</Badge>
		</div>

		{#if visibleTags.length > 0}
			<div class="flex flex-wrap gap-1" aria-label="Tags">
				{#each visibleTags as tag}
					<Badge variant="secondary" class="text-xs font-normal">{tag}</Badge>
				{/each}
				{#if extraTags > 0}
					<Badge variant="outline" class="text-xs font-normal">+{extraTags}</Badge>
				{/if}
			</div>
		{/if}

		{#if onViewStories}
			<div class="pt-1">
				<Button
					type="button"
					variant="ghost"
					size="sm"
					class="h-7 gap-1.5 px-2 text-xs"
					onclick={onViewStories}
				>
					<BookOpenIcon class="h-3 w-3" />
					Stories
				</Button>
			</div>
		{/if}
	</CardContent>
</Card>
