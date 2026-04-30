<script lang="ts">
	import { Button } from '$ui/components/ui/button/index.js';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import ImageIcon from '@lucide/svelte/icons/image';
	import ShuffleIcon from '@lucide/svelte/icons/shuffle';

	interface Props {
		onBatchGenerate: () => void;
		onBatchRegenerate: () => void;
		onAutoTransitions: () => void;
		disabled?: boolean;
		frameCount: number;
	}
	let { onBatchGenerate, onBatchRegenerate, onAutoTransitions, disabled = false, frameCount }: Props = $props();
</script>

{#if frameCount > 0}
	<div class="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-4 py-2.5">
		<span class="mr-1 text-xs font-medium text-muted-foreground">Batch:</span>
		<Button type="button" variant="outline" size="sm" class="gap-1.5 text-xs" onclick={onBatchGenerate} {disabled}>
			<ImageIcon class="h-3 w-3" />
			Generate all missing assets
		</Button>
		<Button type="button" variant="outline" size="sm" class="gap-1.5 text-xs" onclick={onBatchRegenerate} {disabled}>
			<SparklesIcon class="h-3 w-3" />
			Regenerate all prompts
		</Button>
		<Button type="button" variant="outline" size="sm" class="gap-1.5 text-xs" onclick={onAutoTransitions} {disabled}>
			<ShuffleIcon class="h-3 w-3" />
			Auto-assign transitions
		</Button>
	</div>
{/if}
