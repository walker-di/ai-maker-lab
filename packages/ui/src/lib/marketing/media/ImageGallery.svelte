<script lang="ts">
	import { Badge } from '$ui/components/ui/badge/index.js';
	import CheckIcon from '@lucide/svelte/icons/check';
	import ImageIcon from '@lucide/svelte/icons/image';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';

	interface GalleryImage {
		url: string;
		path?: string;
	}

	interface Props {
		images: GalleryImage[];
		onSelect: (url: string) => void;
		selectedUrl?: string;
		isLoading?: boolean;
	}

	let { images, onSelect, selectedUrl, isLoading = false }: Props = $props();
</script>

<div>
	{#if isLoading}
		<div class="flex items-center justify-center py-12">
			<Loader2Icon class="h-6 w-6 animate-spin text-muted-foreground" />
		</div>
	{:else if images.length === 0}
		<div class="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center">
			<ImageIcon class="h-8 w-8 text-muted-foreground" />
			<p class="text-muted-foreground text-sm">No images available</p>
		</div>
	{:else}
		<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
			{#each images as img (img.url)}
				{@const isSelected = selectedUrl === img.url}
				<button
					type="button"
					onclick={() => onSelect(img.url)}
					class="group relative overflow-hidden rounded-lg border-2 transition-all
						{isSelected
							? 'border-primary shadow-md'
							: 'border-transparent hover:border-primary/40'}"
					aria-pressed={isSelected}
				>
					<img
						src={img.url}
						alt={img.path ?? 'Gallery image'}
						class="aspect-square w-full object-cover"
						loading="lazy"
					/>
					{#if isSelected}
						<div class="absolute inset-0 bg-primary/20 flex items-center justify-center">
							<div class="rounded-full bg-primary p-1">
								<CheckIcon class="h-4 w-4 text-primary-foreground" />
							</div>
						</div>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>
