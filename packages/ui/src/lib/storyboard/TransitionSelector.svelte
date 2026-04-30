<script lang="ts">
	import type { StoryboardTransitionType } from './types.js';

	interface Props {
		value: StoryboardTransitionType;
		onValueChange: (type: StoryboardTransitionType) => void;
		disabled?: boolean;
	}
	let { value, onValueChange, disabled = false }: Props = $props();

	const options: { type: StoryboardTransitionType; icon: string; label: string }[] = [
		{ type: 'none', icon: '—', label: 'None' },
		{ type: 'fade', icon: '◐', label: 'Fade' },
		{ type: 'slide', icon: '◄', label: 'Slide' },
		{ type: 'wipe', icon: '▌', label: 'Wipe' },
		{ type: 'zoom', icon: '⊙', label: 'Zoom' },
	];
</script>

<div class="space-y-2">
	<div class="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Transition type">
		{#each options as opt (opt.type)}
			<button
				type="button"
				class="flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-xs transition-colors
					{value === opt.type ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:border-foreground/20 hover:text-foreground'}"
				onclick={() => onValueChange(opt.type)}
				{disabled}
				role="radio"
				aria-checked={value === opt.type}
				aria-label={opt.label}
			>
				<span class="text-base leading-none">{opt.icon}</span>
				<span class="font-medium">{opt.label}</span>
			</button>
		{/each}
	</div>
</div>
