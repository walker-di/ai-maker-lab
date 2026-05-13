<script lang="ts">
	import { Label } from '$ui/components/ui/label/index.js';

	interface Props {
		value: number;
		onValueChange: (ms: number) => void;
		min?: number;
		max?: number;
		disabled?: boolean;
	}
	let { value, onValueChange, min = 100, max = 1500, disabled = false }: Props = $props();
</script>

<div class="space-y-1.5">
	<div class="flex items-center justify-between">
		<Label class="text-xs">Duration</Label>
		<span class="text-xs tabular-nums text-muted-foreground">{value}ms</span>
	</div>
	<input
		type="range"
		class="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary disabled:cursor-not-allowed disabled:opacity-50"
		{min}
		{max}
		step="50"
		{value}
		{disabled}
		oninput={(e) => onValueChange(Number((e.target as HTMLInputElement).value))}
		aria-label="Transition duration"
		aria-valuenow={value}
		aria-valuemin={min}
		aria-valuemax={max}
	/>
	<div class="flex justify-between text-[10px] text-muted-foreground">
		<span>{min}ms</span>
		<span>{max}ms</span>
	</div>
</div>
