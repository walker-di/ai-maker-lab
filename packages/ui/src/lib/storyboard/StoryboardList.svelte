<script lang="ts">
	import StoryboardCard from './StoryboardCard.svelte';
	import StoryboardEmptyState from './StoryboardEmptyState.svelte';
	import type { StoryboardSummary } from './types.js';

	interface Props {
		storyboards: StoryboardSummary[];
		onOpen: (id: string) => void;
		onCreate: () => void;
	}
	let { storyboards, onOpen, onCreate }: Props = $props();
</script>

{#if storyboards.length === 0}
	<StoryboardEmptyState {onCreate} />
{:else}
	<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
		{#each storyboards as storyboard (storyboard.id)}
			<StoryboardCard {storyboard} onOpen={() => onOpen(storyboard.id)} />
		{/each}
	</div>
{/if}
