<script lang="ts">
	import Filmstrip from './Filmstrip.svelte';
	import FrameDetailPanel from './FrameDetailPanel.svelte';
	import type { StoryboardAssetType, StoryboardDetail, StoryboardFrame, StoryboardPromptType } from './types.js';

	interface Props {
		storyboard: StoryboardDetail;
		selectedFrameIndex: number;
		disabled?: boolean;
		onSelectFrame: (index: number) => void;
		onNavigateFrame: (direction: 'prev' | 'next') => void;
		onAddFrames: () => void;
		onSaveText: (frameId: string, input: { title?: string; narration?: string; mainImagePrompt?: string; backgroundImagePrompt?: string; bgmPrompt?: string }) => void | Promise<void>;
		onDelete: (frameId: string) => void | Promise<void>;
		onDuplicate: (frameId: string) => void | Promise<void>;
		onRegeneratePrompt: (frameId: string, promptType: StoryboardPromptType) => void | Promise<void>;
		onGenerateAsset: (frameId: string, assetType: StoryboardAssetType) => void | Promise<void>;
		onUpdateTransition: (frameId: string, input: { transitionTypeAfter: StoryboardFrame['transitionTypeAfter']; transitionDurationMs: number }) => void | Promise<void>;
	}
	let props: Props = $props();

	const selectedFrame = $derived(props.storyboard.frames[props.selectedFrameIndex]);
</script>

<div class="flex h-[600px] flex-col">
	<div class="grid flex-1 grid-cols-[1fr_340px] overflow-hidden">
		<!-- Preview Area -->
		<div class="flex items-center justify-center overflow-hidden bg-muted/10 p-6">
			{#if selectedFrame}
				{#if selectedFrame.mainImageUrl}
					<img
						src={selectedFrame.mainImageUrl}
						alt={selectedFrame.title ?? `Frame ${props.selectedFrameIndex + 1}`}
						class="max-h-full max-w-full rounded-lg object-contain shadow-lg"
					/>
				{:else}
					<div class="flex aspect-video w-full max-w-lg items-center justify-center rounded-lg border border-dashed bg-muted/30">
						<div class="text-center text-muted-foreground">
							<p class="text-sm font-medium">Frame {props.selectedFrameIndex + 1}</p>
							<p class="text-xs">{selectedFrame.title ?? 'No image generated'}</p>
						</div>
					</div>
				{/if}
			{:else}
				<div class="text-center text-muted-foreground">
					<p class="text-sm">No frames yet</p>
				</div>
			{/if}
		</div>

		<!-- Detail Panel -->
		{#if selectedFrame}
			<FrameDetailPanel
				frame={selectedFrame}
				frameIndex={props.selectedFrameIndex}
				frameCount={props.storyboard.frames.length}
				disabled={props.disabled}
				onNavigate={props.onNavigateFrame}
				onSaveText={props.onSaveText}
				onDelete={props.onDelete}
				onDuplicate={props.onDuplicate}
				onRegeneratePrompt={props.onRegeneratePrompt}
				onGenerateAsset={props.onGenerateAsset}
				onUpdateTransition={props.onUpdateTransition}
			/>
		{/if}
	</div>

	<!-- Filmstrip -->
	<Filmstrip
		frames={props.storyboard.frames}
		selectedIndex={props.selectedFrameIndex}
		onSelect={props.onSelectFrame}
		onAdd={props.onAddFrames}
	/>
</div>
