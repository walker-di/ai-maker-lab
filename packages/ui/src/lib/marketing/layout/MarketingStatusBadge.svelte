<script lang="ts">
	import { Badge } from '$ui/components/ui/badge/index.js';
	import { cn } from '$ui/utils.js';
	import type { CampaignStatus } from '../types.js';

	interface Props {
		status: CampaignStatus;
		class?: string;
	}

	let { status, class: className }: Props = $props();

	const statusConfig: Record<CampaignStatus, { label: string; classes: string }> = {
		draft: { label: 'Draft', classes: 'bg-muted text-muted-foreground border-muted-foreground/20' },
		active: { label: 'Active', classes: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' },
		paused: { label: 'Paused', classes: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800' },
		completed: { label: 'Completed', classes: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800' },
	};

	const config = $derived(statusConfig[status] ?? statusConfig.draft);
</script>

<Badge class={cn('capitalize', config.classes, className)}>
	{config.label}
</Badge>
