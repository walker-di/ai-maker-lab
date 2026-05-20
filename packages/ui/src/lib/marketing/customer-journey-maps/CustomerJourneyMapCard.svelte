<script lang="ts">
	import { Button } from '$ui/components/ui/button/index.js';
	import { Badge } from '$ui/components/ui/badge/index.js';
	import { cn } from '$ui/utils.js';
	import MapIcon from '@lucide/svelte/icons/map';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import TrashIcon from '@lucide/svelte/icons/trash';
	import type { CustomerJourneyMap } from '../types.js';

	interface Props {
		journeyMap: CustomerJourneyMap;
		onEdit?: () => void;
		onDelete?: () => void;
	}

	let { journeyMap, onEdit, onDelete }: Props = $props();

	const statusColor = {
		draft: 'bg-muted text-muted-foreground',
		active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
		archived: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
	} as const;

	function stageEmoji(index: number): string {
		const emojis = ['👀', '🔎', '⚙️', '✨', '🚀'];
		return emojis[index % emojis.length];
	}
</script>

<article class="group relative flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm transition hover:shadow-md">
	<header class="flex items-start justify-between gap-3">
		<div class="flex items-start gap-3">
			<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-100 to-blue-100 dark:from-amber-900/30 dark:to-blue-900/30">
				<MapIcon class="h-5 w-5 text-amber-600 dark:text-amber-400" />
			</div>
			<div class="min-w-0">
				<h3 class="truncate text-base font-semibold">{journeyMap.name}</h3>
				<p class="text-muted-foreground mt-0.5 line-clamp-1 text-xs">{journeyMap.description || journeyMap.scenario || 'No description'}</p>
			</div>
		</div>
		<Badge variant="secondary" class={cn('shrink-0 text-xs capitalize', statusColor[journeyMap.status])}>
			{journeyMap.status}
		</Badge>
	</header>

	<!-- Mini stage visualization -->
	{#if journeyMap.stages.length > 0}
		<div class="relative">
			<div class="flex items-center gap-1 overflow-hidden">
				{#each journeyMap.stages as stage, i}
					<div class="flex flex-1 flex-col items-center gap-1">
						<div
							class="flex h-7 w-full min-w-[48px] items-center justify-center rounded-full text-xs font-semibold"
							style="background: linear-gradient(180deg, #ffe08a, #ffb800); color: #1f2937;"
							aria-label={stage.title}
							title={stage.title}
						>
							<span class="truncate px-1">{stageEmoji(i)}</span>
						</div>
						<span class="max-w-full truncate text-[10px] text-muted-foreground">{stage.title}</span>
					</div>
					{#if i < journeyMap.stages.length - 1}
						<div class="h-px w-3 bg-gradient-to-r from-amber-300/50 to-amber-500/30 self-start mt-3.5" aria-hidden="true"></div>
					{/if}
				{/each}
			</div>
		</div>
	{:else}
		<div class="rounded-md border border-dashed py-3 text-center">
			<p class="text-muted-foreground text-xs">No stages defined yet</p>
		</div>
	{/if}

	<!-- Stats row -->
	<div class="flex items-center gap-3 text-xs text-muted-foreground">
		<span class="inline-flex items-center gap-1">
			<span class="font-medium text-foreground">{journeyMap.stages.length}</span> stages
		</span>
		<span>·</span>
		<span class="inline-flex items-center gap-1">
			<span class="font-medium text-foreground">{journeyMap.lanes.length}</span> lanes
		</span>
		<span>·</span>
		<span class="inline-flex items-center gap-1">
			<span class="font-medium text-foreground">{journeyMap.cells.length}</span> cells
		</span>
	</div>

	<!-- Tags -->
	{#if journeyMap.tags.length > 0}
		<div class="flex flex-wrap gap-1.5">
			{#each journeyMap.tags as tag}
				<span class="bg-muted text-muted-foreground inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium">
					{tag}
				</span>
			{/each}
		</div>
	{/if}

	<!-- Actions -->
	<div class="flex items-center justify-end gap-2 pt-1">
		{#if onEdit}
			<Button type="button" variant="ghost" size="sm" class="h-8 gap-1.5 text-xs" onclick={onEdit}>
				<PencilIcon class="h-3.5 w-3.5" />
				Edit
			</Button>
		{/if}
		{#if onDelete}
			<Button type="button" variant="ghost" size="sm" class="h-8 gap-1.5 text-xs text-destructive hover:text-destructive" onclick={onDelete}>
				<TrashIcon class="h-3.5 w-3.5" />
				Delete
			</Button>
		{/if}
	</div>
</article>
