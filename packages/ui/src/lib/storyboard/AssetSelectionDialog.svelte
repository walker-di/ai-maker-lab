<script lang="ts">
	import * as Dialog from '$ui/components/ui/dialog/index.js';
	import { Button } from '$ui/components/ui/button/index.js';
	import type { StoryboardAssetRef } from './types.js';
	interface Props { open: boolean; assets: StoryboardAssetRef[]; onOpenChange: (open: boolean) => void; onSelect: (asset: StoryboardAssetRef) => void; }
	let { open, assets, onOpenChange, onSelect }: Props = $props();
</script>

<Dialog.Root {open} onOpenChange={onOpenChange}>
	<Dialog.Content><Dialog.Header><Dialog.Title>Select asset</Dialog.Title></Dialog.Header>
		<div class="grid gap-2">{#each assets as asset (asset.url)}<Button type="button" variant="outline" onclick={() => onSelect(asset)}>{asset.url}</Button>{/each}</div>
	</Dialog.Content>
</Dialog.Root>
