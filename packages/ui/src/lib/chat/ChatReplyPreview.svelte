<script lang="ts">
	import { Button } from '$ui/components/ui/button/index.js';

	interface Props {
		parentContent: string;
		onClear?: () => void;
	}

	let { parentContent, onClear }: Props = $props();
</script>

<div class="bg-muted/50 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
	<span class="text-muted-foreground shrink-0">Replying to:</span>
	<span class="flex-1 truncate">{parentContent}</span>
	{#if onClear}
		<Button variant="ghost" size="sm" class="h-6 w-6 shrink-0 p-0" onclick={onClear}>
			✕
		</Button>
	{/if}
</div>
