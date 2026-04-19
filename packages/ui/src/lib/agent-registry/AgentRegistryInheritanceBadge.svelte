<script lang="ts">
	import { Badge } from '$ui/components/ui/badge/index.js';
	import type { AgentRegistryStatus } from './types.js';

	interface Props {
		status: AgentRegistryStatus;
	}

	let { status }: Props = $props();

	const labels: Record<Exclude<AgentRegistryStatus, 'system'>, string> = {
		inherited: 'Inherited',
		duplicated: 'Duplicated',
		custom: 'Custom',
	};
</script>

{#if status !== 'system'}
	<Badge variant={status === 'custom' ? 'secondary' : 'outline'} class="text-[10px] uppercase tracking-wide">
		{labels[status]}
	</Badge>
{/if}
