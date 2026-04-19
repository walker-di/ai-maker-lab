<script lang="ts">
	import InfoIcon from '@lucide/svelte/icons/info';

	interface Props {
		title: string;
		description: string;
	}

	let { title, description }: Props = $props();
</script>

<div
	class="border-muted-foreground/20 bg-muted/40 flex items-start gap-3 rounded-2xl border p-5"
	role="status"
>
	<InfoIcon class="text-muted-foreground mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
	<div class="space-y-1">
		<p class="text-sm font-semibold">{title}</p>
		<p class="text-muted-foreground text-sm leading-6">{description}</p>
	</div>
</div>
