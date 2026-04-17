<script lang="ts">
	import type { AttachmentRef } from './types.js';
	import { badgeVariants } from '$ui/components/ui/badge/index.js';
	import { cn } from '$ui/utils.js';

	interface Props {
		attachment: AttachmentRef;
		removable?: boolean;
		onRemove?: () => void;
		onOpen?: (attachment: AttachmentRef) => void;
	}

	let { attachment, removable = false, onRemove, onOpen }: Props = $props();

	const iconMap: Record<string, string> = {
		image: '🖼',
		text: '📝',
		pdf: '📑',
		video: '🎬',
		unsupported: '📎',
	};

	let isUnavailable = $derived(attachment.status === 'unavailable');
	let isRejected = $derived(attachment.status === 'rejected');
	let hasWarning = $derived(isUnavailable || isRejected);
	let isClickable = $derived(Boolean(onOpen) && !hasWarning);

	function handleOpen() {
		onOpen?.(attachment);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleOpen();
		}
	}
</script>

<div class="inline-flex items-center gap-1">
	{#if isClickable}
		<button
			type="button"
			class={cn(
				badgeVariants({ variant: hasWarning ? 'destructive' : 'secondary' }),
				'hover:bg-secondary/80 cursor-pointer gap-1 text-xs',
				hasWarning ? 'opacity-70' : '',
			)}
			aria-label={`Preview ${attachment.name}`}
			onclick={handleOpen}
			onkeydown={handleKeydown}
		>
			<span>{iconMap[attachment.type] ?? '📎'}</span>
			<span class="max-w-24 truncate">{attachment.name}</span>
			{#if isUnavailable}
				<span class="text-[10px]" title="File not found">⚠</span>
			{:else if isRejected}
				<span class="text-[10px]" title="Unsupported by model">✕</span>
			{/if}
		</button>
	{:else}
		<span
			class={cn(
				badgeVariants({ variant: hasWarning ? 'destructive' : 'secondary' }),
				'gap-1 text-xs',
				hasWarning ? 'opacity-70' : '',
			)}
		>
			<span>{iconMap[attachment.type] ?? '📎'}</span>
			<span class="max-w-24 truncate">{attachment.name}</span>
			{#if isUnavailable}
				<span class="text-[10px]" title="File not found">⚠</span>
			{:else if isRejected}
				<span class="text-[10px]" title="Unsupported by model">✕</span>
			{/if}
		</span>
	{/if}
	{#if removable && onRemove}
		<button
			type="button"
			class="hover:text-destructive -mr-1 ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full"
			onclick={(e) => { e.stopPropagation(); onRemove?.(); }}
			title="Remove"
		>
			<svg class="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
				<path d="M18 6 6 18" /><path d="m6 6 12 12" />
			</svg>
		</button>
	{/if}
</div>
