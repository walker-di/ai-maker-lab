<script lang="ts">
	import ChatMessageBubble from '../ChatMessageBubble.svelte';

	const conversation = [
		{ role: 'user' as const, content: 'Hello! Can you help me write a function that sorts an array?' },
		{
			role: 'assistant' as const,
			content: 'Of course! Here\'s a simple sorting function that uses the built-in Array.sort() method with a custom comparator.',
			agentName: 'Coder',
			agentSource: 'system' as const,
		},
		{ role: 'user' as const, content: 'Can you make it work with objects too?' },
		{
			role: 'assistant' as const,
			content: 'Sure! You can pass a key extractor function to compare object properties. Here\'s an updated version.',
			agentName: 'Coder',
			agentSource: 'system' as const,
		},
	];
</script>

<div class="dark bg-background text-foreground p-6" data-testid="conversation-fixture" style="width: 600px; font-family: system-ui, sans-serif;">
	<div class="space-y-4">
		{#each conversation as msg, idx (idx)}
			<ChatMessageBubble
				role={msg.role}
				content={msg.content}
				agentName={msg.agentName}
				agentSource={msg.agentSource}
			/>
		{/each}
	</div>
</div>
