<script lang="ts">
	import { Button } from '$ui/components/ui/button/index.js';
	import StoryboardFrameCard from './StoryboardFrameCard.svelte';
	import type { StoryboardAssetType, StoryboardDetail, StoryboardPromptType } from './types.js';

	interface Props {
		storyboard: StoryboardDetail;
		isLoading?: boolean;
		onBack: () => void;
		onAddFrames: () => void;
		onInsertBlankFrame: (afterFrameId?: string) => void | Promise<void>;
		onSaveText: (frameId: string, input: { title?: string; narration?: string; mainImagePrompt?: string; backgroundImagePrompt?: string; bgmPrompt?: string }) => void | Promise<void>;
		onReorder: (frameId: string, direction: 'up' | 'down') => void | Promise<void>;
		onDelete: (frameId: string) => void | Promise<void>;
		onRegeneratePrompt: (frameId: string, promptType: StoryboardPromptType) => void | Promise<void>;
		onGenerateAsset: (frameId: string, assetType: StoryboardAssetType) => void | Promise<void>;
		onUpdateTransition: (frameId: string, input: { transitionTypeAfter: 'none' | 'fade' | 'slide' | 'wipe' | 'zoom'; transitionDurationMs: number }) => void | Promise<void>;
		onExport: () => void | Promise<void>;
	}
	let props: Props = $props();
</script>

<div class="space-y-6">
	<div class="flex flex-wrap items-start justify-between gap-3">
		<div>
			<Button type="button" variant="ghost" class="mb-2 px-0" onclick={props.onBack}>← Back to storyboards</Button>
			<h1 class="text-3xl font-bold tracking-tight">{props.storyboard.name}</h1>
			<p class="text-muted-foreground text-sm">{props.storyboard.frameCount} frames</p>
		</div>
		<div class="flex flex-wrap gap-2">
			<Button type="button" variant="outline" onclick={props.onAddFrames} disabled={props.isLoading}>Generate frames</Button>
			<Button type="button" variant="outline" onclick={() => props.onInsertBlankFrame()} disabled={props.isLoading}>Insert blank</Button>
			<Button type="button" onclick={props.onExport} disabled={props.isLoading || props.storyboard.frames.length === 0}>Export video</Button>
		</div>
	</div>

	{#if props.storyboard.frames.length === 0}
		<div class="rounded-xl border border-dashed p-10 text-center">
			<h2 class="font-semibold">No frames yet</h2>
			<p class="text-muted-foreground mb-4 text-sm">Generate frames from a prompt or insert a blank frame.</p>
			<Button type="button" onclick={props.onAddFrames}>Generate frames</Button>
		</div>
	{:else}
		<div class="space-y-4">
			{#each props.storyboard.frames as frame (frame.id)}
				<StoryboardFrameCard
					{frame}
					disabled={props.isLoading}
					onSaveText={props.onSaveText}
					onReorder={props.onReorder}
					onDelete={props.onDelete}
					onRegeneratePrompt={props.onRegeneratePrompt}
					onGenerateAsset={props.onGenerateAsset}
					onUpdateTransition={props.onUpdateTransition}
				/>
			{/each}
		</div>
	{/if}
</div>
