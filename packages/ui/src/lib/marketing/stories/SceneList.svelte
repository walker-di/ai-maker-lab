<script lang="ts">
	import { Button } from '$ui/components/ui/button/index.js';
	import { Badge } from '$ui/components/ui/badge/index.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import LayersIcon from '@lucide/svelte/icons/layers';
	import type { Scene } from '../types.js';

	interface Props {
		scenes: Scene[];
		activeSceneId?: string;
		onSelectScene: (id: string) => void;
		onAddScene?: () => void;
		onDeleteScene?: (id: string) => void;
		onReorder?: (orderedIds: string[]) => void;
	}

	let {
		scenes,
		activeSceneId,
		onSelectScene,
		onAddScene,
		onDeleteScene,
		onReorder,
	}: Props = $props();

	const sorted = $derived([...scenes].sort((a, b) => a.orderIndex - b.orderIndex));

	let draggingId = $state<string | null>(null);
	let overIndex = $state<number | null>(null);

	function handleDragStart(e: DragEvent, id: string) {
		draggingId = id;
		e.dataTransfer?.setData('text/plain', id);
	}

	function handleDragOver(e: DragEvent, idx: number) {
		e.preventDefault();
		overIndex = idx;
	}

	function handleDrop(e: DragEvent, targetIdx: number) {
		e.preventDefault();
		if (!draggingId) return;

		const currentOrder = sorted.map((s) => s.id);
		const fromIdx = currentOrder.indexOf(draggingId);
		if (fromIdx === -1 || fromIdx === targetIdx) {
			draggingId = null;
			overIndex = null;
			return;
		}

		const reordered = [...currentOrder];
		const [moved] = reordered.splice(fromIdx, 1);
		reordered.splice(targetIdx, 0, moved);

		onReorder?.(reordered);
		draggingId = null;
		overIndex = null;
	}

	function handleDragEnd() {
		draggingId = null;
		overIndex = null;
	}
</script>

<div class="flex flex-col gap-1">
	{#each sorted as scene, idx (scene.id)}
		<div
			draggable={!!onReorder}
			ondragstart={(e) => handleDragStart(e, scene.id)}
			ondragover={(e) => handleDragOver(e, idx)}
			ondrop={(e) => handleDrop(e, idx)}
			ondragend={handleDragEnd}
			class="group flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors
				{scene.id === activeSceneId ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}
				{overIndex === idx && draggingId !== scene.id ? 'border-t-2 border-t-primary' : ''}
				{draggingId === scene.id ? 'opacity-50' : ''}"
		>
			{#if onReorder}
				<GripVerticalIcon
					class="h-4 w-4 shrink-0 cursor-grab text-muted-foreground"
					aria-hidden="true"
				/>
			{/if}

			<button
				type="button"
				class="flex flex-1 items-center gap-2 text-left"
				onclick={() => onSelectScene(scene.id)}
			>
				<Badge variant="outline" class="h-5 min-w-[1.5rem] shrink-0 text-xs tabular-nums">
					{scene.orderIndex + 1}
				</Badge>
				<div class="min-w-0 flex-1">
					{#if scene.description}
						<p class="truncate text-sm">{scene.description}</p>
					{:else}
						<p class="text-muted-foreground text-sm">Scene {scene.orderIndex + 1}</p>
					{/if}
					{#if scene.durationMs}
						<p class="text-muted-foreground text-xs">{(scene.durationMs / 1000).toFixed(1)}s</p>
					{/if}
				</div>
				{#if scene.canvasData}
					<Badge variant="secondary" class="shrink-0 text-xs font-normal">Canvas</Badge>
				{/if}
			</button>

			{#if onDeleteScene}
				<Button
					type="button"
					variant="ghost"
					size="icon"
					class="h-7 w-7 shrink-0 text-destructive opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
					onclick={() => onDeleteScene(scene.id)}
					aria-label="Delete scene"
				>
					<TrashIcon class="h-3.5 w-3.5" />
				</Button>
			{/if}
		</div>
	{/each}

	{#if onAddScene}
		<Button
			type="button"
			variant="outline"
			size="sm"
			class="mt-1 gap-1.5"
			onclick={onAddScene}
		>
			<PlusIcon class="h-4 w-4" />
			Add Scene
		</Button>
	{:else if scenes.length === 0}
		<div class="flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-center">
			<LayersIcon class="h-8 w-8 text-muted-foreground" />
			<p class="text-muted-foreground text-sm">No scenes yet</p>
		</div>
	{/if}
</div>
