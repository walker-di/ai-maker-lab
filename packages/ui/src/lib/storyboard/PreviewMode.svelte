<script lang="ts">
	import { Button } from '$ui/components/ui/button/index.js';
	import XIcon from '@lucide/svelte/icons/x';
	import SkipBackIcon from '@lucide/svelte/icons/skip-back';
	import SkipForwardIcon from '@lucide/svelte/icons/skip-forward';
	import PlayIcon from '@lucide/svelte/icons/play';
	import PauseIcon from '@lucide/svelte/icons/pause';
	import type { StoryboardDetail } from './types.js';

	interface Props {
		storyboard: StoryboardDetail;
		selectedFrameIndex: number;
		isPlaying: boolean;
		onTogglePlayback: () => void;
		onNavigateFrame: (direction: 'prev' | 'next') => void;
		onSelectFrame: (index: number) => void;
		onExit: () => void;
	}
	let props: Props = $props();

	const currentFrame = $derived(props.storyboard.frames[props.selectedFrameIndex]);
</script>

<div class="relative flex h-[560px] flex-col bg-black">
	<!-- Exit -->
	<Button
		type="button"
		variant="ghost"
		size="sm"
		class="absolute right-4 top-4 z-10 gap-1 text-white/70 hover:bg-white/10 hover:text-white"
		onclick={props.onExit}
	>
		<XIcon class="h-4 w-4" /> Exit
	</Button>

	<!-- Frame Display -->
	<div class="flex flex-1 items-center justify-center p-8">
		{#if currentFrame}
			{#if currentFrame.mainImageUrl}
				<img
					src={currentFrame.mainImageUrl}
					alt={currentFrame.title ?? 'Frame'}
					class="max-h-full max-w-full rounded-lg shadow-2xl"
				/>
			{:else}
				<div class="flex aspect-video w-full max-w-xl items-center justify-center rounded-lg border border-white/10 bg-white/5">
					<p class="text-sm text-white/50">{currentFrame.title ?? `Frame ${props.selectedFrameIndex + 1}`}</p>
				</div>
			{/if}
		{/if}
	</div>

	<!-- Narration Subtitle -->
	{#if currentFrame?.narration}
		<div class="absolute bottom-[120px] left-1/2 max-w-lg -translate-x-1/2 rounded-lg bg-black/75 px-5 py-2.5 text-center text-sm text-white backdrop-blur-sm">
			{currentFrame.narration}
		</div>
	{/if}

	<!-- Transport Controls -->
	<div class="border-t border-white/10 bg-black/90 px-6 py-4">
		<!-- Progress Segments -->
		<div class="mb-3 flex items-center gap-0.5">
			{#each props.storyboard.frames as _, i}
				<button
					type="button"
					class="h-1 flex-1 rounded-full transition-colors
						{i < props.selectedFrameIndex ? 'bg-primary' : i === props.selectedFrameIndex ? 'bg-primary/70' : 'bg-white/15'}"
					onclick={() => props.onSelectFrame(i)}
					aria-label="Go to frame {i + 1}"
				></button>
			{/each}
		</div>

		<div class="flex items-center justify-between">
			<div class="flex items-center gap-3">
				<button type="button" class="grid h-8 w-8 place-items-center rounded-full border border-white/15 text-white hover:bg-white/10" onclick={() => props.onNavigateFrame('prev')}>
					<SkipBackIcon class="h-3.5 w-3.5" />
				</button>
				<button type="button" class="grid h-10 w-10 place-items-center rounded-full bg-primary text-white hover:bg-primary/90" onclick={props.onTogglePlayback}>
					{#if props.isPlaying}
						<PauseIcon class="h-4 w-4" />
					{:else}
						<PlayIcon class="h-4 w-4" />
					{/if}
				</button>
				<button type="button" class="grid h-8 w-8 place-items-center rounded-full border border-white/15 text-white hover:bg-white/10" onclick={() => props.onNavigateFrame('next')}>
					<SkipForwardIcon class="h-3.5 w-3.5" />
				</button>
				<span class="text-xs text-white/60">Frame {props.selectedFrameIndex + 1} / {props.storyboard.frames.length}</span>
			</div>
			<div class="flex items-center gap-2">
				{#if currentFrame?.transitionTypeAfter !== 'none'}
					<span class="text-xs text-white/40">{currentFrame?.transitionTypeAfter} → next</span>
				{/if}
			</div>
		</div>
	</div>
</div>
