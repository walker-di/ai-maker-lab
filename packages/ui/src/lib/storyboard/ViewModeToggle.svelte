<script lang="ts">
	import { Button } from '$ui/components/ui/button/index.js';
	import LayoutListIcon from '@lucide/svelte/icons/layout-list';
	import GridIcon from '@lucide/svelte/icons/grid-2x2';
	import PlayIcon from '@lucide/svelte/icons/play';
	import type { StoryboardViewMode } from './types.js';

	interface Props {
		mode: StoryboardViewMode;
		onModeChange: (mode: StoryboardViewMode) => void;
		disabled?: boolean;
	}
	let { mode, onModeChange, disabled = false }: Props = $props();

	const options: { value: StoryboardViewMode; icon: typeof LayoutListIcon; label: string }[] = [
		{ value: 'timeline', icon: LayoutListIcon, label: 'Timeline' },
		{ value: 'grid', icon: GridIcon, label: 'Grid' },
		{ value: 'preview', icon: PlayIcon, label: 'Preview' },
	];
</script>

<div class="inline-flex items-center rounded-lg border bg-muted/30 p-0.5" role="radiogroup" aria-label="View mode">
	{#each options as opt (opt.value)}
		<Button
			type="button"
			variant={mode === opt.value ? 'secondary' : 'ghost'}
			size="sm"
			class="gap-1.5 px-3 text-xs {mode === opt.value ? 'shadow-sm' : ''}"
			onclick={() => onModeChange(opt.value)}
			{disabled}
			aria-checked={mode === opt.value}
			role="radio"
		>
			<opt.icon class="h-3.5 w-3.5" />
			{opt.label}
		</Button>
	{/each}
</div>
