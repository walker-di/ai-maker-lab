<script lang="ts">
	import { onMount } from 'svelte';
	import LayersIcon from '@lucide/svelte/icons/layers';

	interface Props {
		canvasData?: string | null;
		width?: number;
		height?: number;
	}

	let { canvasData, width = 200, height = 150 }: Props = $props();

	let previewUrl = $state<string | null>(null);
	let hasError = $state(false);

	async function renderPreview() {
		if (!canvasData) {
			previewUrl = null;
			return;
		}

		try {
			const { StaticCanvas } = await import('fabric');
			const offscreen = document.createElement('canvas');
			offscreen.width = width;
			offscreen.height = height;
			const staticCanvas = new StaticCanvas(offscreen, { width, height });
			await staticCanvas.loadFromJSON(canvasData);
			staticCanvas.renderAll();
			previewUrl = staticCanvas.toDataURL({ format: 'png', multiplier: 1 });
			staticCanvas.dispose();
		} catch {
			hasError = true;
			previewUrl = null;
		}
	}

	onMount(() => { void renderPreview(); });

	$effect(() => {
		if (canvasData !== undefined) {
			void renderPreview();
		}
	});
</script>

{#if previewUrl}
	<img src={previewUrl} alt="Canvas preview" class="rounded border object-contain" style="width: {width}px; height: {height}px;" />
{:else}
	<div
		class="flex items-center justify-center rounded border bg-muted text-muted-foreground"
		style="width: {width}px; height: {height}px;"
	>
		<LayersIcon class="h-5 w-5 opacity-50" />
	</div>
{/if}
