<script lang="ts">
	import ChatMessageBubble from '../ChatMessageBubble.svelte';
	import ChatSubthreadPreview from '../ChatSubthreadPreview.svelte';
	import ChatSubthreadPanel from '../ChatSubthreadPanel.svelte';
	import ChatSubthreadMessageList from '../ChatSubthreadMessageList.svelte';
	import ChatSubthreadEmptyState from '../ChatSubthreadEmptyState.svelte';

	interface Props {
		variant?: 'preview' | 'panel-empty' | 'panel-replies';
	}

	let { variant = 'preview' }: Props = $props();
</script>

<div
	class="dark bg-background text-foreground p-6"
	data-testid="subthread-fixture"
	style="width: 720px; font-family: system-ui, sans-serif;"
>
	{#if variant === 'preview'}
		<ChatSubthreadPreview
			replyCount={3}
			latestReplyPreview="We should split the deployment step into a separate job."
			active={true}
		/>
	{:else}
		<div class="h-[520px] border">
			<ChatSubthreadPanel title="Thread" replyCount={variant === 'panel-replies' ? 2 : 0}>
				{#snippet parent()}
					<ChatMessageBubble
						role="user"
						content="Can you review the deployment pipeline changes?"
					/>
				{/snippet}

				{#snippet content()}
					<ChatSubthreadMessageList>
						{#if variant === 'panel-empty'}
							<ChatSubthreadEmptyState />
						{:else}
							<ChatMessageBubble
								role="assistant"
								content="I’d separate build and deploy so failures are easier to isolate."
								agentName="Research Analyst"
								agentSource="system"
							/>
							<ChatMessageBubble
								role="user"
								content="Makes sense. I’ll break that out."
							/>
						{/if}
					</ChatSubthreadMessageList>
				{/snippet}

				{#snippet footer()}
					<div class="text-muted-foreground text-sm">Reply composer goes here</div>
				{/snippet}
			</ChatSubthreadPanel>
		</div>
	{/if}
</div>
