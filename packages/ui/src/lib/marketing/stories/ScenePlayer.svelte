<script lang="ts">
	import { Badge } from '$ui/components/ui/badge/index.js';
	import { Card, CardContent } from '$ui/components/ui/card/index.js';
	import LayersIcon from '@lucide/svelte/icons/layers';
	import type { Scene } from '../types.js';

	interface Props {
		scene: Scene;
		isActive?: boolean;
	}

	let { scene, isActive = false }: Props = $props();

	const durationLabel = $derived(
		scene.durationMs != null ? `${(scene.durationMs / 1000).toFixed(1)}s` : null
	);
</script>

<Card
	class="transition-shadow {isActive
		? 'border-primary ring-1 ring-primary shadow-md'
		: 'hover:shadow-sm'}"
>
	<CardContent class="flex flex-col gap-3 p-4">
		<div class="flex items-center justify-between gap-2">
			<div class="flex items-center gap-2">
				<LayersIcon class="h-4 w-4 text-muted-foreground" />
				<span class="text-sm font-medium">
					{scene.description ?? `Scene ${scene.orderIndex + 1}`}
				</span>
			</div>
			{#if isActive}
				<Badge class="text-xs">Active</Badge>
			{/if}
		</div>

		<div class="flex flex-wrap gap-2 text-xs text-muted-foreground">
			<span>Order: {scene.orderIndex + 1}</span>
			{#if durationLabel}
				<span>· {durationLabel}</span>
			{/if}
		</div>

		{#if scene.canvasData}
			<div class="rounded-md bg-muted px-2 py-1.5">
				<Badge variant="secondary" class="text-xs font-normal">Canvas data present</Badge>
			</div>
		{/if}
	</CardContent>
</Card>
