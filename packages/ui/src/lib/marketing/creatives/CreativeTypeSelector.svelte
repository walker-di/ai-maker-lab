<script lang="ts">
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import ImageIcon from '@lucide/svelte/icons/image';
	import VideoIcon from '@lucide/svelte/icons/video';
	import LayoutIcon from '@lucide/svelte/icons/layout';
	import type { CreativeType } from '../types.js';

	interface Props {
		selectedType?: CreativeType;
		onSelect: (type: CreativeType) => void;
	}

	let { selectedType, onSelect }: Props = $props();

	const types: {
		value: CreativeType;
		label: string;
		description: string;
		icon: typeof FileTextIcon;
	}[] = [
		{
			value: 'text',
			label: 'Text',
			description: 'Ad copy, headlines, body text',
			icon: FileTextIcon,
		},
		{
			value: 'image',
			label: 'Image',
			description: 'Static image creatives',
			icon: ImageIcon,
		},
		{
			value: 'video',
			label: 'Video',
			description: 'Video ads and clips',
			icon: VideoIcon,
		},
		{
			value: 'landing_page',
			label: 'Landing Page',
			description: 'Dedicated conversion pages',
			icon: LayoutIcon,
		},
	];
</script>

<div class="grid grid-cols-2 gap-3 sm:grid-cols-4" role="radiogroup" aria-label="Creative type">
	{#each types as t}
		{@const isSelected = selectedType === t.value}
		<button
			type="button"
			role="radio"
			aria-checked={isSelected}
			onclick={() => onSelect(t.value)}
			class="flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors
				{isSelected
					? 'border-primary bg-primary/5 text-primary'
					: 'border-border hover:border-primary/50 hover:bg-muted/50'}"
		>
			<t.icon class="h-6 w-6 shrink-0" />
			<span class="text-sm font-medium leading-tight">{t.label}</span>
			<span class="text-muted-foreground text-xs leading-snug">{t.description}</span>
		</button>
	{/each}
</div>
