<script lang="ts">
	import { dndzone } from 'svelte-dnd-action';
	import { Badge } from '$ui/components/ui/badge/index.js';
	import AssetStatusDots from './AssetStatusDots.svelte';
	import type { StoryboardDetail, StoryboardFrame } from './types.js';

	interface Props {
		storyboard: StoryboardDetail;
		selectedFrameIndex: number;
		disabled?: boolean;
		onSelectFrame: (index: number) => void;
		onReorder: (frameId: string, direction: 'up' | 'down') => void | Promise<void>;
		onAddFrames: () => void;
	}
	let props: Props = $props();

	let items = $state(props.storyboard.frames.map((f) => ({ ...f })));

	$effect(() => {
		items = props.storyboard.frames.map((f) => ({ ...f }));
	});

	function handleDndConsider(e: CustomEvent<{ items: StoryboardFrame[] }>) {
		items = e.detail.items;
	}

	function handleDndFinalize(e: CustomEvent<{ items: StoryboardFrame[] }>) {
		items = e.detail.items;
		const movedFrame = items.find((item, idx) => {
			const original = props.storyboard.frames[idx];
			return original && item.id !== original.id;
		});
		if (movedFrame) {
			const oldIdx = props.storyboard.frames.findIndex((f) => f.id === movedFrame.id);
			const newIdx = items.findIndex((f) => f.id === movedFrame.id);
			if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
				props.onReorder(movedFrame.id, newIdx < oldIdx ? 'up' : 'down');
			}
		}
	}
</script>

<div class="space-y-4 p-4">
	<div
		class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
		use:dndzone={{ items, flipDurationMs: 200, dragDisabled: props.disabled }}
		onconsider={handleDndConsider}
		onfinalize={handleDndFinalize}
	>
		{#each items as frame, i (frame.id)}
			<button
				type="button"
				class="overflow-hidden rounded-lg border text-left transition-all hover:shadow-md
					{props.selectedFrameIndex === i ? 'border-primary ring-1 ring-primary/20' : 'border-border'}"
				onclick={() => props.onSelectFrame(i)}
			>
				<div class="aspect-video w-full bg-muted">
					{#if frame.mainImageUrl}
						<img src={frame.mainImageUrl} alt={frame.title ?? `Frame ${i + 1}`} class="h-full w-full object-cover" />
					{:else}
						<div class="flex h-full w-full items-center justify-center text-xs text-muted-foreground">No image</div>
					{/if}
				</div>
				<div class="space-y-1 p-3">
					<p class="truncate text-xs font-medium">{i + 1}. {frame.title ?? 'Untitled'}</p>
					<p class="line-clamp-2 text-[11px] text-muted-foreground">{frame.narration}</p>
					<div class="flex items-center justify-between pt-1">
						<AssetStatusDots {frame} />
						{#if frame.transitionTypeAfter !== 'none'}
							<Badge variant="secondary" class="text-[9px]">{frame.transitionTypeAfter} {frame.transitionDurationMs}ms</Badge>
						{/if}
					</div>
				</div>
			</button>
		{/each}
	</div>

	<button
		type="button"
		class="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-sm text-muted-foreground hover:border-primary hover:text-primary"
		onclick={props.onAddFrames}
		disabled={props.disabled}
	>
		<span class="text-lg">+</span> Add frames
	</button>
</div>
