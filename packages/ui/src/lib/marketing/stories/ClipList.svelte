<script lang="ts">
	import { Button } from '$ui/components/ui/button/index.js';
	import { Badge } from '$ui/components/ui/badge/index.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import ImageIcon from '@lucide/svelte/icons/image';
	import VideoIcon from '@lucide/svelte/icons/video';
	import TypeIcon from '@lucide/svelte/icons/type';
	import type { Clip } from '../types.js';

	interface Props {
		clips: Clip[];
		onAdd?: () => void;
		onEdit?: (clip: Clip) => void;
		onDelete?: (id: string) => void;
	}

	let { clips, onAdd, onEdit, onDelete }: Props = $props();

	const sorted = $derived([...clips].sort((a, b) => a.orderIndex - b.orderIndex));

	function getTypeIcon(type: string) {
		switch (type) {
			case 'image': return ImageIcon;
			case 'video': return VideoIcon;
			default: return TypeIcon;
		}
	}

	function getPreview(clip: Clip): string {
		if (clip.content) return clip.content.slice(0, 50);
		if (clip.narrationText) return clip.narrationText.slice(0, 50);
		if (clip.imageUrl) return 'Image clip';
		if (clip.videoUrl) return 'Video clip';
		return '(empty)';
	}
</script>

<div class="flex flex-col gap-2">
	{#each sorted as clip (clip.id)}
		<div class="group flex items-center gap-2 rounded-md border bg-card px-3 py-2 transition hover:shadow-sm">
			<GripVerticalIcon class="h-4 w-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab" />

			<Badge variant="secondary" class="shrink-0 text-xs">
				<svelte:component this={getTypeIcon(clip.type)} class="mr-1 h-3 w-3" />
				{clip.type}
			</Badge>

			<span class="flex-1 truncate text-sm text-muted-foreground">{getPreview(clip)}</span>

			{#if clip.durationMs}
				<span class="shrink-0 text-xs text-muted-foreground">{(clip.durationMs / 1000).toFixed(1)}s</span>
			{/if}

			<div class="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100">
				{#if onEdit}
					<Button variant="ghost" size="icon" class="h-6 w-6" onclick={() => onEdit!(clip)} title="Edit clip">
						<PencilIcon class="h-3 w-3" />
					</Button>
				{/if}
				{#if onDelete}
					<Button variant="ghost" size="icon" class="h-6 w-6 text-destructive" onclick={() => onDelete!(clip.id)} title="Delete clip">
						<TrashIcon class="h-3 w-3" />
					</Button>
				{/if}
			</div>
		</div>
	{/each}

	{#if onAdd}
		<Button variant="outline" size="sm" class="mt-1 w-full" onclick={onAdd}>
			<PlusIcon class="mr-1.5 h-3.5 w-3.5" /> Add Clip
		</Button>
	{/if}
</div>
