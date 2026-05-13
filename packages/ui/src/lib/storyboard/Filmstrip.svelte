<script lang="ts">
	import type { StoryboardFrame } from './types.js';
	import AssetStatusDots from './AssetStatusDots.svelte';

	interface Props {
		frames: StoryboardFrame[];
		selectedIndex: number;
		onSelect: (index: number) => void;
		onAdd: () => void;
	}
	let { frames, selectedIndex, onSelect, onAdd }: Props = $props();
</script>

<div class="flex items-center gap-0 overflow-x-auto border-t bg-muted/20 px-4 py-3">
	{#each frames as frame, i (frame.id)}
		{#if i > 0}
			<div class="flex shrink-0 flex-col items-center px-1">
				<span class="h-px w-3 bg-border"></span>
				<span class="text-[8px] text-muted-foreground">{frames[i - 1].transitionTypeAfter !== 'none' ? frames[i - 1].transitionTypeAfter : ''}</span>
			</div>
		{/if}
		<button
			type="button"
			class="relative flex h-12 w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-md border-2 transition-all
				{selectedIndex === i ? 'border-primary shadow-sm shadow-primary/20' : 'border-transparent hover:border-muted-foreground/30'}"
			onclick={() => onSelect(i)}
			aria-label="Frame {i + 1}"
			aria-selected={selectedIndex === i}
		>
			{#if frame.mainImageUrl}
				<img src={frame.mainImageUrl} alt="Frame {i + 1}" class="h-full w-full object-cover" />
			{:else}
				<div class="flex h-full w-full items-center justify-center bg-muted text-[10px] text-muted-foreground">{i + 1}</div>
			{/if}
			<span class="absolute left-1 top-0.5 text-[9px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{i + 1}</span>
			<span class="absolute bottom-1 right-1">
				<AssetStatusDots {frame} />
			</span>
		</button>
	{/each}
	<button
		type="button"
		class="ml-2 flex h-12 w-[72px] shrink-0 items-center justify-center rounded-md border border-dashed border-muted-foreground/30 text-lg text-muted-foreground hover:border-primary hover:text-primary"
		onclick={onAdd}
		aria-label="Add frame"
	>
		+
	</button>
</div>
