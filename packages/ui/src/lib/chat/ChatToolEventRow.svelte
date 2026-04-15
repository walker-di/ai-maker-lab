<script lang="ts">
	interface Props {
		toolName: string;
		status?: 'pending' | 'running' | 'completed' | 'failed';
	}

	let { toolName, status = 'pending' }: Props = $props();

	const statusIcon: Record<string, string> = {
		pending: '⏳',
		running: '⚙️',
		completed: '✅',
		failed: '❌',
	};
</script>

<div class="text-muted-foreground flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs">
	<span>{statusIcon[status]}</span>
	<span class="font-mono">{toolName}</span>
	{#if status === 'running'}
		<span class="animate-pulse">...</span>
	{/if}
</div>
