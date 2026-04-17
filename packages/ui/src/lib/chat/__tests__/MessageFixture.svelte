<script lang="ts">
	import ChatMessageBubble from '../ChatMessageBubble.svelte';
	import type { AssistantMessagePart, AttachmentRef } from '../types.js';

	interface Props {
		variant?:
			| 'user'
			| 'assistant'
			| 'assistant-markdown'
			| 'assistant-rich'
			| 'assistant-overflow'
			| 'streaming'
			| 'failed'
			| 'with-attachments';
		previewable?: boolean;
	}

	let { variant = 'user', previewable = false }: Props = $props();

	const sampleAttachments: AttachmentRef[] = [
		{
			id: 'att-1',
			messageId: 'msg-1',
			type: 'image',
			name: 'screenshot.png',
			mimeType: 'image/png',
			path: '/tmp/screenshot.png',
			size: 1024,
			lastModified: '2026-04-15T12:00:00.000Z',
			status: 'ready',
		},
		{
			id: 'att-2',
			messageId: 'msg-1',
			type: 'pdf',
			name: 'report.pdf',
			mimeType: 'application/pdf',
			path: '/tmp/report.pdf',
			size: 2048,
			lastModified: '2026-04-15T12:01:00.000Z',
			status: 'ready',
		},
	];

	const markdownMessage = `## Build plan

- Open the repo in [Cursor](https://cursor.com)
- Run \`bun test\`

\`\`\`ts
export function greet(name: string) {
\treturn \`Hello, \\${name}\`;
}
\`\`\`
`;

	const longTokenMessage =
		'Visit https://example.com/' +
		'this-is-a-ridiculously-long-chat-message-token-that-should-wrap-instead-of-pushing-the-bubble-outside-the-layout/'.repeat(
			3,
		);

	const assistantParts: AssistantMessagePart[] = [
		{
			type: 'text',
			text: "Here's the generated image.",
		},
		{
			type: 'image',
			url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9sZrxh8AAAAASUVORK5CYII=',
			name: 'eyecatch.png',
			alt: 'Generated eyecatch',
		},
	];
</script>

<div
	class="dark bg-background text-foreground p-6"
	data-testid="messages-fixture"
	style={`width: ${variant === 'assistant-overflow' ? 360 : 600}px; font-family: system-ui, sans-serif;`}
>
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
		{:else if variant === 'assistant-markdown'}
			<ChatMessageBubble
				role="assistant"
				content={markdownMessage}
				agentName="Coder"
				agentSource="system"
			/>
		{:else if variant === 'assistant-rich'}
			<ChatMessageBubble
				role="assistant"
				assistantParts={assistantParts}
				agentName="Coder"
				agentSource="system"
			/>
		{:else if variant === 'assistant-overflow'}
			<ChatMessageBubble
				role="assistant"
				content={longTokenMessage}
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
				onAttachmentOpen={previewable ? () => undefined : undefined}
			/>
		{/if}
	</div>
</div>
