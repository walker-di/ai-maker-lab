<script lang="ts">
	import { Button } from '$ui/components/ui/button/index.js';
	import { Card, CardContent, CardHeader, CardTitle } from '$ui/components/ui/card/index.js';
	import { Badge } from '$ui/components/ui/badge/index.js';
	import FilmIcon from '@lucide/svelte/icons/film';
	import type { StoryboardSummary } from './types.js';

	interface Props {
		storyboard: StoryboardSummary;
		onOpen: () => void;
	}

	let { storyboard, onOpen }: Props = $props();
	const updated = $derived(new Date(storyboard.updatedAt).toLocaleDateString());
</script>

<Card class="transition-shadow hover:shadow-md">
	<CardHeader class="pb-2">
		<div class="flex items-start gap-2">
			<FilmIcon class="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
			<div class="min-w-0 flex-1">
				<CardTitle class="truncate text-base">{storyboard.name}</CardTitle>
				<p class="text-muted-foreground text-xs">Updated {updated}</p>
			</div>
		</div>
	</CardHeader>
	<CardContent class="space-y-3">
		{#if storyboard.description}
			<p class="text-muted-foreground line-clamp-2 text-sm">{storyboard.description}</p>
		{/if}
		<div class="flex items-center justify-between gap-2">
			<Badge variant="secondary">{storyboard.frameCount} frames</Badge>
			<Button type="button" size="sm" onclick={onOpen}>Open</Button>
		</div>
	</CardContent>
</Card>
