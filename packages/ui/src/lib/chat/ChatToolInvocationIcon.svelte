<script lang="ts">
	import Code2Icon from '@lucide/svelte/icons/code-2';
	import FileSearchIcon from '@lucide/svelte/icons/file-search';
	import GlobeIcon from '@lucide/svelte/icons/globe';
	import ImageIcon from '@lucide/svelte/icons/image';
	import MapPinnedIcon from '@lucide/svelte/icons/map-pinned';
	import RadarIcon from '@lucide/svelte/icons/radar';
	import SearchIcon from '@lucide/svelte/icons/search';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import SquareTerminalIcon from '@lucide/svelte/icons/square-terminal';
	import WaypointsIcon from '@lucide/svelte/icons/waypoints';
	import type { ToolInvocationIconName } from './types.js';

	interface Props {
		icon: ToolInvocationIconName;
		class?: string;
	}

	let { icon, class: className = '' }: Props = $props();
</script>

{#if icon === 'web-search'}
	<SearchIcon class={className} />
{:else if icon === 'web-fetch'}
	<GlobeIcon class={className} />
{:else if icon === 'image-generation'}
	<ImageIcon class={className} />
{:else if icon === 'code-execution'}
	<Code2Icon class={className} />
{:else if icon === 'code-interpreter'}
	<SquareTerminalIcon class={className} />
{:else if icon === 'file-search'}
	<FileSearchIcon class={className} />
{:else if icon === 'google-search'}
	<RadarIcon class={className} />
{:else if icon === 'url-context'}
	<WaypointsIcon class={className} />
{:else if icon === 'google-maps'}
	<MapPinnedIcon class={className} />
{:else}
	<SparklesIcon class={className} />
{/if}
