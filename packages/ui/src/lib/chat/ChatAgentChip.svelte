<script lang="ts">
	import type { AgentSource } from './types.js';
	import { cn } from '$ui/utils.js';

	interface Props {
		name: string;
		source?: AgentSource;
		class?: string;
	}

	let { name, source, class: className }: Props = $props();
</script>

<span
	class={cn(
		'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
		source === 'system'
			? 'bg-primary/10 text-primary'
			: 'bg-secondary text-secondary-foreground',
		className
	)}
>
	{name}
</span>
