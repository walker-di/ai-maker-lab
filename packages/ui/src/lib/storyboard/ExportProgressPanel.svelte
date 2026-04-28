<script lang="ts">
	import { Button } from '$ui/components/ui/button/index.js';
	interface Props { status: 'idle' | 'exporting' | 'done' | 'error'; downloadUrl?: string; error?: string; onClose?: () => void; }
	let { status, downloadUrl, error, onClose }: Props = $props();
</script>

{#if status !== 'idle'}
	<div class="rounded-lg border p-4">
		{#if status === 'exporting'}<p class="text-sm font-medium">Exporting storyboard video…</p>{/if}
		{#if status === 'done'}<p class="text-sm font-medium text-green-600">Export complete.</p>{/if}
		{#if status === 'error'}<p class="text-sm font-medium text-destructive">{error ?? 'Export failed.'}</p>{/if}
		<div class="mt-3 flex gap-2">
			{#if downloadUrl}<a class="text-sm underline" href={downloadUrl} download>Download</a>{/if}
			{#if onClose}<Button type="button" variant="outline" size="sm" onclick={onClose}>Dismiss</Button>{/if}
		</div>
	</div>
{/if}
