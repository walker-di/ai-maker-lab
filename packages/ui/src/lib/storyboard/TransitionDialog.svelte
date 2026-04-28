<script lang="ts">
	import * as Dialog from '$ui/components/ui/dialog/index.js';
	import { Button } from '$ui/components/ui/button/index.js';
	interface Props { open: boolean; onOpenChange: (open: boolean) => void; children?: import('svelte').Snippet; }
	let { open, onOpenChange, children }: Props = $props();
</script>

<Dialog.Root {open} onOpenChange={onOpenChange}>
	<Dialog.Content><Dialog.Header><Dialog.Title>Transition</Dialog.Title></Dialog.Header>{@render children?.()}<Dialog.Footer><Button type="button" variant="outline" onclick={() => onOpenChange(false)}>Close</Button></Dialog.Footer></Dialog.Content>
</Dialog.Root>
