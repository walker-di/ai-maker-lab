<script lang="ts">
	import ChatMessageBubble from '../ChatMessageBubble.svelte';
	import type { AttachmentRef, AgentSource } from '../types.js';

	interface Props {
		variant?: 'user' | 'assistant' | 'streaming' | 'failed' | 'with-attachments';
	}

	let { variant = 'user' }: Props = $props();

	const sampleAttachments: AttachmentRef[] = [
		{ id: 'att-1', messageId: 'msg-1', type: 'image', name: 'screenshot.png', mimeType: 'image/png' },
		{ id: 'att-2', messageId: 'msg-1', type: 'pdf', name: 'report.pdf', mimeType: 'application/pdf' },
	];
</script>

<div class="dark bg-background text-foreground p-6" data-testid="messages-fixture" style="width: 600px; font-family: system-ui, sans-serif;">
	<div class="space-y-4">
		{#if variant === 'user'}
			<ChatMessageBubble
				role="user"
				content="Hello! Can you help me write a function that sorts an array?"
			/>
		{:else if variant === 'assistant'}
			<ChatMessageBubble
				role="assistant"
				content="Of course! Here's a simple sorting function that uses the built-in Array.sort() method with a custom comparator."
				agentName="Coder"
				agentSource="system"
			/>
		{:else if variant === 'streaming'}
			<ChatMessageBubble
				role="assistant"
				content="Let me think about that"
				agentName="Auto"
				agentSource="system"
				isStreaming={true}
			/>
		{:else if variant === 'failed'}
			<ChatMessageBubble
				role="assistant"
				content=""
				isFailed={true}
			/>
		{:else if variant === 'with-attachments'}
			<ChatMessageBubble
				role="user"
				content="Here are the files you requested."
				attachments={sampleAttachments}
			/>
		{/if}
	</div>
</div>
