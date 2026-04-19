<script lang="ts">
	import ChatThreadListItem from '../ChatThreadListItem.svelte';
	import type { ChatThread } from '../types.js';

	const threads: ChatThread[] = [
		{
			id: 'thread-1',
			title: 'Sorting algorithm help',
			participantIds: ['agent-coder'],
			createdAt: '2026-04-14T10:00:00Z',
			updatedAt: '2026-04-14T12:30:00Z',
		},
		{
			id: 'thread-2',
			title: 'Design system review',
			participantIds: ['agent-auto'],
			createdAt: '2026-04-13T09:00:00Z',
			updatedAt: '2026-04-13T18:00:00Z',
		},
		{
			id: 'thread-3',
			title: 'API integration questions',
			participantIds: ['agent-coder', 'agent-auto'],
			createdAt: '2026-04-12T14:00:00Z',
			updatedAt: '2026-04-12T16:45:00Z',
		},
	];
</script>

<div class="dark bg-background text-foreground p-4" data-testid="thread-list-fixture" style="width: 256px; font-family: system-ui, sans-serif;">
	<div class="space-y-1">
		{#each threads as thread, idx (thread.id)}
			<ChatThreadListItem
				{thread}
				active={idx === 0}
			/>
		{/each}
	</div>
</div>
