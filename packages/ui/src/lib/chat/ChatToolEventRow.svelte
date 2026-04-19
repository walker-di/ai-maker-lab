<script lang="ts">
	import ChatToolInvocationPill from './ChatToolInvocationPill.svelte';
	import type { ToolInvocationInfo } from './types.js';

	interface Props {
		toolName: string;
		status?: 'pending' | 'running' | 'completed' | 'failed';
		invocation?: ToolInvocationInfo;
		onclick?: () => void;
	}

	let { toolName, status = 'pending', invocation, onclick }: Props = $props();

	const effectiveStatus = $derived(
		invocation
			? invocation.state === 'output-available'
				? 'completed'
				: invocation.state === 'error'
					? 'failed'
					: invocation.state === 'input-streaming'
						? 'running'
						: 'running'
			: status,
	);

	const synthesizedInvocation = $derived<ToolInvocationInfo>(
		invocation ?? {
			toolCallId: toolName,
			toolName,
			state:
				effectiveStatus === 'completed'
					? 'output-available'
					: effectiveStatus === 'failed'
						? 'error'
						: 'input-streaming',
			input: undefined,
			output: undefined,
		},
	);
</script>

<ChatToolInvocationPill invocation={synthesizedInvocation} {onclick} />
