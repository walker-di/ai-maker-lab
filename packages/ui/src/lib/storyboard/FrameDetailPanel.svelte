<script lang="ts">
	import { Button } from '$ui/components/ui/button/index.js';
	import { Label } from '$ui/components/ui/label/index.js';
	import { Input } from '$ui/components/ui/input/index.js';
	import { Textarea } from '$ui/components/ui/textarea/index.js';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import TransitionSelector from './TransitionSelector.svelte';
	import DurationSlider from './DurationSlider.svelte';
	import type { StoryboardAssetType, StoryboardFrame, StoryboardPromptType } from './types.js';

	interface Props {
		frame: StoryboardFrame;
		frameIndex: number;
		frameCount: number;
		disabled?: boolean;
		onNavigate: (direction: 'prev' | 'next') => void;
		onSaveText: (frameId: string, input: { title?: string; narration?: string; mainImagePrompt?: string; backgroundImagePrompt?: string; bgmPrompt?: string }) => void | Promise<void>;
		onDelete: (frameId: string) => void | Promise<void>;
		onDuplicate: (frameId: string) => void | Promise<void>;
		onRegeneratePrompt: (frameId: string, promptType: StoryboardPromptType) => void | Promise<void>;
		onGenerateAsset: (frameId: string, assetType: StoryboardAssetType) => void | Promise<void>;
		onUpdateTransition: (frameId: string, input: { transitionTypeAfter: StoryboardFrame['transitionTypeAfter']; transitionDurationMs: number }) => void | Promise<void>;
	}
	let props: Props = $props();

	let title = $state(props.frame.title ?? '');
	let narration = $state(props.frame.narration);
	let mainImagePrompt = $state(props.frame.mainImagePrompt);
	let backgroundImagePrompt = $state(props.frame.backgroundImagePrompt);
	let bgmPrompt = $state(props.frame.bgmPrompt);
	let transitionTypeAfter = $state(props.frame.transitionTypeAfter);
	let transitionDurationMs = $state(props.frame.transitionDurationMs);

	$effect(() => {
		title = props.frame.title ?? '';
		narration = props.frame.narration;
		mainImagePrompt = props.frame.mainImagePrompt;
		backgroundImagePrompt = props.frame.backgroundImagePrompt;
		bgmPrompt = props.frame.bgmPrompt;
		transitionTypeAfter = props.frame.transitionTypeAfter;
		transitionDurationMs = props.frame.transitionDurationMs;
	});
</script>

<div class="flex h-full flex-col overflow-y-auto border-l bg-card">
	<div class="flex items-center justify-between border-b px-4 py-3">
		<h3 class="text-sm font-semibold">Frame {props.frameIndex + 1} of {props.frameCount}</h3>
		<div class="flex gap-1">
			<Button type="button" variant="ghost" size="icon" class="h-7 w-7" onclick={() => props.onNavigate('prev')} disabled={props.disabled || props.frameIndex === 0} aria-label="Previous frame">
				<ChevronLeftIcon class="h-3.5 w-3.5" />
			</Button>
			<Button type="button" variant="ghost" size="icon" class="h-7 w-7" onclick={() => props.onNavigate('next')} disabled={props.disabled || props.frameIndex >= props.frameCount - 1} aria-label="Next frame">
				<ChevronRightIcon class="h-3.5 w-3.5" />
			</Button>
		</div>
	</div>

	<div class="flex-1 space-y-3 overflow-y-auto p-4">
		<div class="space-y-1">
			<Label class="text-xs">Title</Label>
			<Input bind:value={title} disabled={props.disabled} class="h-8 text-sm" />
		</div>

		<div class="space-y-1">
			<div class="flex items-center justify-between">
				<Label class="text-xs">Narration</Label>
				<button type="button" class="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80" onclick={() => props.onRegeneratePrompt(props.frame.id, 'narration')}>
					<SparklesIcon class="h-2.5 w-2.5" /> Regen
				</button>
			</div>
			<Textarea bind:value={narration} rows={2} disabled={props.disabled} class="text-sm" />
		</div>

		<div class="space-y-1">
			<div class="flex items-center justify-between">
				<Label class="text-xs">Main image prompt</Label>
				<button type="button" class="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80" onclick={() => props.onRegeneratePrompt(props.frame.id, 'mainImage')}>
					<SparklesIcon class="h-2.5 w-2.5" /> Regen
				</button>
			</div>
			<Textarea bind:value={mainImagePrompt} rows={2} disabled={props.disabled} class="text-sm" />
		</div>

		<div class="space-y-1">
			<Label class="text-xs">Background prompt</Label>
			<Textarea bind:value={backgroundImagePrompt} rows={2} disabled={props.disabled} class="text-sm" />
		</div>

		<div class="space-y-1">
			<Label class="text-xs">BGM prompt</Label>
			<Textarea bind:value={bgmPrompt} rows={1} disabled={props.disabled} class="text-sm" />
		</div>

		<div class="flex flex-wrap gap-1.5">
			<Button type="button" size="sm" class="h-7 text-xs" onclick={() => props.onSaveText(props.frame.id, { title, narration, mainImagePrompt, backgroundImagePrompt, bgmPrompt })} disabled={props.disabled}>Save</Button>
			<Button type="button" variant="outline" size="sm" class="h-7 text-xs" onclick={() => props.onGenerateAsset(props.frame.id, 'mainImage')} disabled={props.disabled}>Gen image</Button>
			<Button type="button" variant="outline" size="sm" class="h-7 text-xs" onclick={() => props.onGenerateAsset(props.frame.id, 'backgroundImage')} disabled={props.disabled}>Gen background</Button>
			<Button type="button" variant="outline" size="sm" class="h-7 text-xs" onclick={() => props.onGenerateAsset(props.frame.id, 'narrationAudio')} disabled={props.disabled}>Gen audio</Button>
			<Button type="button" variant="outline" size="sm" class="h-7 text-xs" onclick={() => props.onGenerateAsset(props.frame.id, 'bgm')} disabled={props.disabled}>Gen BGM</Button>
		</div>

		<div class="space-y-2 rounded-lg border bg-muted/20 p-3">
			<span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Transition after</span>
			<TransitionSelector value={transitionTypeAfter} onValueChange={(t) => { transitionTypeAfter = t; props.onUpdateTransition(props.frame.id, { transitionTypeAfter: t, transitionDurationMs }); }} disabled={props.disabled} />
			<DurationSlider value={transitionDurationMs} onValueChange={(ms) => { transitionDurationMs = ms; props.onUpdateTransition(props.frame.id, { transitionTypeAfter, transitionDurationMs: ms }); }} disabled={props.disabled} />
		</div>
	</div>

	<div class="flex gap-2 border-t px-4 py-2">
		<Button type="button" variant="outline" size="sm" class="gap-1 text-xs" onclick={() => props.onDuplicate(props.frame.id)} disabled={props.disabled}>
			<CopyIcon class="h-3 w-3" /> Duplicate
		</Button>
		<Button type="button" variant="ghost" size="sm" class="gap-1 text-xs text-destructive" onclick={() => props.onDelete(props.frame.id)} disabled={props.disabled}>
			<TrashIcon class="h-3 w-3" /> Delete
		</Button>
	</div>
</div>
