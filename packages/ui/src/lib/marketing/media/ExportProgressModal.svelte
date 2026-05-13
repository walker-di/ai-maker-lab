<script lang="ts">
	import { Button } from '$ui/components/ui/button/index.js';
	import * as Dialog from '$ui/components/ui/dialog/index.js';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import CheckCircleIcon from '@lucide/svelte/icons/check-circle';
	import XCircleIcon from '@lucide/svelte/icons/x-circle';
	import DownloadIcon from '@lucide/svelte/icons/download';

	type ExportStatus = 'idle' | 'exporting' | 'done' | 'error';

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		status: ExportStatus;
		progress?: number;
		downloadUrl?: string;
		errorMessage?: string;
	}

	let { open, onOpenChange, status, progress, downloadUrl, errorMessage }: Props = $props();

	const clampedProgress = $derived(Math.max(0, Math.min(100, progress ?? 0)));
</script>

<Dialog.Root {open} onOpenChange={onOpenChange}>
	<Dialog.Content class="max-w-sm">
		<Dialog.Header>
			<Dialog.Title>Export</Dialog.Title>
		</Dialog.Header>

		<div class="flex flex-col items-center gap-4 py-4">
			{#if status === 'exporting'}
				<Loader2Icon class="h-10 w-10 animate-spin text-primary" />
				<p class="text-sm font-medium">Exporting…</p>
				{#if progress != null}
					<div class="w-full">
						<div class="bg-muted h-2 w-full overflow-hidden rounded-full">
							<div
								class="bg-primary h-full rounded-full transition-all duration-300"
								style="width: {clampedProgress}%"
							></div>
						</div>
						<p class="text-muted-foreground mt-1 text-right text-xs">{clampedProgress}%</p>
					</div>
				{/if}
			{:else if status === 'done'}
				<CheckCircleIcon class="h-10 w-10 text-green-500" />
				<p class="text-sm font-medium">Export complete!</p>
				{#if downloadUrl}
					<a
						href={downloadUrl}
						download
						class="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
					>
						<DownloadIcon class="h-4 w-4" />
						Download
					</a>
				{/if}
			{:else if status === 'error'}
				<XCircleIcon class="h-10 w-10 text-destructive" />
				<p class="text-sm font-medium">Export failed</p>
				{#if errorMessage}
					<p class="text-muted-foreground text-center text-sm">{errorMessage}</p>
				{/if}
			{:else}
				<p class="text-muted-foreground text-sm">Ready to export.</p>
			{/if}
		</div>

		<Dialog.Footer>
			<Button
				type="button"
				variant="outline"
				onclick={() => onOpenChange(false)}
				disabled={status === 'exporting'}
			>
				{status === 'exporting' ? 'Please wait…' : 'Close'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
