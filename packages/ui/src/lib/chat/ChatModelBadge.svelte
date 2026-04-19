<script lang="ts">
	import type { ModelUiPresentation } from './types.js';
	import { Badge } from '$ui/components/ui/badge/index.js';

	interface Props {
		presentation: ModelUiPresentation;
	}

	let { presentation }: Props = $props();
</script>

{#if presentation.badges.length > 0}
	<div class="flex flex-wrap gap-1">
		{#each presentation.badges as label (label)}
			<Badge variant="outline" class="text-xs capitalize">{label}</Badge>
		{/each}
	</div>
{/if}
