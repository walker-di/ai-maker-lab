<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle } from '$ui/components/ui/card/index.js';
	import { Button } from '$ui/components/ui/button/index.js';
	import { Badge } from '$ui/components/ui/badge/index.js';
	import EditIcon from '@lucide/svelte/icons/pencil';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import FolderOpenIcon from '@lucide/svelte/icons/folder-open';
	import FilmIcon from '@lucide/svelte/icons/film';
	import type { Story } from '../types.js';

	interface Props {
		story: Story;
		sceneCount?: number;
		onEdit?: () => void;
		onDelete?: () => void;
		onOpen?: () => void;
	}

	let { story, sceneCount = 0, onEdit, onDelete, onOpen }: Props = $props();

	const durationLabel = $derived(
		story.totalDuration != null
			? story.totalDuration >= 60
				? `${Math.floor(story.totalDuration / 60)}m ${story.totalDuration % 60}s`
				: `${story.totalDuration}s`
			: null
	);
</script>

<Card class="group relative flex flex-col transition-shadow hover:shadow-md">
	<CardHeader class="pb-2">
		<div class="flex items-start justify-between gap-2">
			<div class="flex items-center gap-2 min-w-0">
				<FilmIcon class="h-4 w-4 shrink-0 text-muted-foreground" />
				<CardTitle class="truncate text-sm leading-snug">{story.title}</CardTitle>
			</div>
			<div class="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
				{#if onEdit}
					<Button
						type="button"
						variant="ghost"
						size="icon"
						class="h-7 w-7"
						onclick={onEdit}
						aria-label="Edit {story.title}"
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
						aria-label="Delete {story.title}"
					>
						<TrashIcon class="h-3.5 w-3.5" />
					</Button>
				{/if}
			</div>
		</div>
	</CardHeader>

	<CardContent class="flex flex-1 flex-col gap-2">
		{#if story.description}
			<p class="text-muted-foreground line-clamp-2 text-xs">{story.description}</p>
		{/if}

		<div class="flex flex-wrap items-center gap-2">
			<Badge variant="secondary" class="gap-1 text-xs font-normal">
				<FilmIcon class="h-3 w-3" />
				{sceneCount} {sceneCount === 1 ? 'scene' : 'scenes'}
			</Badge>
			{#if durationLabel}
				<span class="text-muted-foreground text-xs">{durationLabel}</span>
			{/if}
		</div>

		{#if onOpen}
			<div class="pt-1">
				<Button
					type="button"
					variant="ghost"
					size="sm"
					class="h-7 gap-1.5 px-2 text-xs"
					onclick={onOpen}
				>
					<FolderOpenIcon class="h-3 w-3" />
					Open
				</Button>
			</div>
		{/if}
	</CardContent>
</Card>
