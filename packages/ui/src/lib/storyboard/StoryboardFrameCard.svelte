<script lang="ts">
	import { Button } from '$ui/components/ui/button/index.js';
	import { Card, CardContent, CardHeader, CardTitle } from '$ui/components/ui/card/index.js';
	import { Textarea } from '$ui/components/ui/textarea/index.js';
	import { Input } from '$ui/components/ui/input/index.js';
	import { Label } from '$ui/components/ui/label/index.js';
	import { Badge } from '$ui/components/ui/badge/index.js';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import ImageIcon from '@lucide/svelte/icons/image';
	import MusicIcon from '@lucide/svelte/icons/music';
	import Volume2Icon from '@lucide/svelte/icons/volume-2';
	import type { StoryboardAssetType, StoryboardFrame, StoryboardPromptType } from './types.js';

	interface Props {
		frame: StoryboardFrame;
		disabled?: boolean;
		onSaveText: (frameId: string, input: { title?: string; narration?: string; mainImagePrompt?: string; backgroundImagePrompt?: string; bgmPrompt?: string }) => void | Promise<void>;
		onReorder: (frameId: string, direction: 'up' | 'down') => void | Promise<void>;
		onDelete: (frameId: string) => void | Promise<void>;
		onRegeneratePrompt: (frameId: string, promptType: StoryboardPromptType) => void | Promise<void>;
		onGenerateAsset: (frameId: string, assetType: StoryboardAssetType) => void | Promise<void>;
		onUpdateTransition: (frameId: string, input: { transitionTypeAfter: StoryboardFrame['transitionTypeAfter']; transitionDurationMs: number }) => void | Promise<void>;
	}
	let { frame, disabled = false, onSaveText, onReorder, onDelete, onRegeneratePrompt, onGenerateAsset, onUpdateTransition }: Props = $props();
	let title = $state(frame.title ?? '');
	let narration = $state(frame.narration);
	let mainImagePrompt = $state(frame.mainImagePrompt);
	let backgroundImagePrompt = $state(frame.backgroundImagePrompt);
	let bgmPrompt = $state(frame.bgmPrompt);
	let transitionTypeAfter = $state(frame.transitionTypeAfter);
	let transitionDurationMs = $state(frame.transitionDurationMs);

	$effect(() => {
		title = frame.title ?? '';
		narration = frame.narration;
		mainImagePrompt = frame.mainImagePrompt;
		backgroundImagePrompt = frame.backgroundImagePrompt;
		bgmPrompt = frame.bgmPrompt;
		transitionTypeAfter = frame.transitionTypeAfter;
		transitionDurationMs = frame.transitionDurationMs;
	});
</script>

<Card>
	<CardHeader>
		<div class="flex items-start justify-between gap-3">
			<div><CardTitle class="text-base">Frame {frame.orderIndex + 1}</CardTitle><p class="text-muted-foreground text-xs">{frame.id}</p></div>
			<div class="flex gap-1">
				<Button type="button" variant="ghost" size="icon" onclick={() => onReorder(frame.id, 'up')} disabled={disabled} aria-label="Move frame up"><ArrowUpIcon class="h-4 w-4" /></Button>
				<Button type="button" variant="ghost" size="icon" onclick={() => onReorder(frame.id, 'down')} disabled={disabled} aria-label="Move frame down"><ArrowDownIcon class="h-4 w-4" /></Button>
				<Button type="button" variant="ghost" size="icon" onclick={() => onDelete(frame.id)} disabled={disabled} aria-label="Delete frame"><TrashIcon class="h-4 w-4" /></Button>
			</div>
		</div>
	</CardHeader>
	<CardContent class="space-y-4">
		<div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
			<div class="space-y-3">
				<div class="space-y-1"><Label for="title-{frame.id}">Title</Label><Input id="title-{frame.id}" bind:value={title} disabled={disabled} /></div>
				<div class="space-y-1"><Label for="narration-{frame.id}">Narration</Label><Textarea id="narration-{frame.id}" bind:value={narration} rows={3} disabled={disabled} /></div>
				<div class="space-y-1"><Label for="main-{frame.id}">Main image prompt</Label><Textarea id="main-{frame.id}" bind:value={mainImagePrompt} rows={2} disabled={disabled} /></div>
				<div class="space-y-1"><Label for="bg-{frame.id}">Background image prompt</Label><Textarea id="bg-{frame.id}" bind:value={backgroundImagePrompt} rows={2} disabled={disabled} /></div>
				<div class="space-y-1"><Label for="bgm-{frame.id}">BGM prompt</Label><Textarea id="bgm-{frame.id}" bind:value={bgmPrompt} rows={2} disabled={disabled} /></div>
			</div>
			<div class="space-y-3">
				<div class="rounded-lg border bg-muted/30 p-3">
					{#if frame.mainImageUrl}<img src={frame.mainImageUrl} alt="Main frame" class="aspect-square w-full rounded-md object-cover" />{:else}<div class="flex aspect-square items-center justify-center rounded-md bg-muted text-sm text-muted-foreground">No main image</div>{/if}
				</div>
				<div class="flex flex-wrap gap-2">
					{#if frame.backgroundImageUrl}<Badge variant="secondary"><ImageIcon class="mr-1 h-3 w-3" />Background</Badge>{/if}
					{#if frame.narrationAudioUrl}<Badge variant="secondary"><Volume2Icon class="mr-1 h-3 w-3" />Narration</Badge>{/if}
					{#if frame.bgmUrl}<Badge variant="secondary"><MusicIcon class="mr-1 h-3 w-3" />BGM</Badge>{/if}
				</div>
			</div>
		</div>

		<div class="flex flex-wrap gap-2">
			<Button type="button" size="sm" onclick={() => onSaveText(frame.id, { title, narration, mainImagePrompt, backgroundImagePrompt, bgmPrompt })} disabled={disabled}>Save text</Button>
			<Button type="button" size="sm" variant="outline" onclick={() => onRegeneratePrompt(frame.id, 'narration')} disabled={disabled}><SparklesIcon class="mr-1 h-3 w-3" />Narration</Button>
			<Button type="button" size="sm" variant="outline" onclick={() => onGenerateAsset(frame.id, 'mainImage')} disabled={disabled}>Generate main image</Button>
			<Button type="button" size="sm" variant="outline" onclick={() => onGenerateAsset(frame.id, 'backgroundImage')} disabled={disabled}>Generate background</Button>
			<Button type="button" size="sm" variant="outline" onclick={() => onGenerateAsset(frame.id, 'narrationAudio')} disabled={disabled} aria-label={`Generate narration audio for frame ${frame.orderIndex + 1}`}>Generate narration</Button>
			<Button type="button" size="sm" variant="outline" onclick={() => onGenerateAsset(frame.id, 'bgm')} disabled={disabled}>Generate BGM</Button>
		</div>

		<div class="grid gap-2 sm:grid-cols-[1fr_8rem_auto]">
			<div class="space-y-1"><Label for="transition-{frame.id}">Transition after frame</Label><Input id="transition-{frame.id}" bind:value={transitionTypeAfter} disabled={disabled} placeholder="none, fade, slide…" /></div>
			<div class="space-y-1"><Label for="transition-ms-{frame.id}">Duration ms</Label><Input id="transition-ms-{frame.id}" type="number" bind:value={transitionDurationMs} disabled={disabled} /></div>
			<Button type="button" class="self-end" variant="outline" onclick={() => onUpdateTransition(frame.id, { transitionTypeAfter, transitionDurationMs })} disabled={disabled}>Save transition</Button>
		</div>
	</CardContent>
</Card>
