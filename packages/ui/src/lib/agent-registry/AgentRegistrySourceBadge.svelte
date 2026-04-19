<script lang="ts">
	import { Badge } from '$ui/components/ui/badge/index.js';
	import type { AgentRegistrySource } from './types.js';

	interface Props {
		source: AgentRegistrySource;
	}

	let { source }: Props = $props();
</script>

<Badge variant="outline" class="text-[10px] uppercase tracking-wide">
	{source === 'system' ? 'System' : 'User'}
</Badge>
