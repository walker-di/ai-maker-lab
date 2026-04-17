<script lang="ts">
	import { cn } from '$ui/utils.js';

	interface Props {
		replyCount: number;
		active?: boolean;
	}

	let { replyCount, active = false }: Props = $props();

	const label = $derived(replyCount === 1 ? 'reply' : 'replies');
</script>

<span
	class={cn(
		'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
		active ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground',
	)}
>
	{replyCount} {label}
</span>
