<script lang="ts">
	import * as Dialog from '$ui/components/ui/dialog/index.js';
	import { Button } from '$ui/components/ui/button/index.js';
	interface Props { open: boolean; prompt?: string; onOpenChange: (open: boolean) => void; onAccept?: () => void; }
	let { open, prompt, onOpenChange, onAccept }: Props = $props();
</script>

<Dialog.Root {open} onOpenChange={onOpenChange}>
	<Dialog.Content><Dialog.Header><Dialog.Title>Regenerated prompt</Dialog.Title></Dialog.Header>
		<p class="text-sm whitespace-pre-wrap">{prompt}</p>
		<Dialog.Footer>{#if onAccept}<Button type="button" onclick={onAccept}>Accept</Button>{/if}</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
