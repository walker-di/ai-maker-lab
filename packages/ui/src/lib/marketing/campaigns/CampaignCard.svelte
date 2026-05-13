<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle } from '$ui/components/ui/card/index.js';
	import { Button } from '$ui/components/ui/button/index.js';
	import EditIcon from '@lucide/svelte/icons/pencil';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import MarketingStatusBadge from '../layout/MarketingStatusBadge.svelte';
	import type { Campaign } from '../types.js';

	interface Props {
		campaign: Campaign;
		onEdit?: () => void;
		onDelete?: () => void;
	}

	let { campaign, onEdit, onDelete }: Props = $props();

	const truncatedDescription = $derived(
		campaign.description.length > 100
			? campaign.description.slice(0, 100) + '…'
			: campaign.description
	);

	const dateRange = $derived(() => {
		if (!campaign.startDate && !campaign.endDate) return null;
		const start = campaign.startDate ? new Date(campaign.startDate).toLocaleDateString() : null;
		const end = campaign.endDate ? new Date(campaign.endDate).toLocaleDateString() : null;
		if (start && end) return `${start} – ${end}`;
		if (start) return `From ${start}`;
		if (end) return `Until ${end}`;
		return null;
	});
</script>

<Card class="group relative flex flex-col transition-shadow hover:shadow-md">
	<CardHeader class="pb-2">
		<div class="flex items-start justify-between gap-2">
			<div class="flex flex-col gap-1.5">
				<CardTitle class="text-base leading-snug">{campaign.name}</CardTitle>
				<MarketingStatusBadge status={campaign.status} />
			</div>
			<div class="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
				{#if onEdit}
					<Button
						type="button"
						variant="ghost"
						size="icon"
						class="h-7 w-7"
						onclick={onEdit}
						aria-label="Edit {campaign.name}"
					>
						<EditIcon class="h-3.5 w-3.5" />
					</Button>
				{/if}
				{#if onDelete}
					<Button
						type="button"
						variant="ghost"
						size="icon"
						class="h-7 w-7 text-destructive hover:text-destructive"
						onclick={onDelete}
						aria-label="Delete {campaign.name}"
					>
						<TrashIcon class="h-3.5 w-3.5" />
					</Button>
				{/if}
			</div>
		</div>
	</CardHeader>

	<CardContent class="flex flex-1 flex-col gap-2">
		{#if truncatedDescription}
			<p class="text-muted-foreground text-sm leading-relaxed">{truncatedDescription}</p>
		{/if}
		{#if dateRange()}
			<div class="text-muted-foreground flex items-center gap-1.5 text-xs">
				<CalendarIcon class="h-3 w-3" />
				{dateRange()}
			</div>
		{/if}
	</CardContent>
</Card>
