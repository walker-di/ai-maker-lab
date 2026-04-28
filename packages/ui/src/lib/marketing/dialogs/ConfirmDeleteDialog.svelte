<script lang="ts">
	import { Button } from '$ui/components/ui/button/index.js';
	import * as Dialog from '$ui/components/ui/dialog/index.js';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import TrashIcon from '@lucide/svelte/icons/trash-2';

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		title: string;
		description: string;
		onConfirm: () => void | Promise<void>;
		isDeleting?: boolean;
	}

	let { open, onOpenChange, title, description, onConfirm, isDeleting = false }: Props = $props();

	async function handleConfirm() {
		await onConfirm();
	}
</script>

<Dialog.Root {open} onOpenChange={onOpenChange}>
	<Dialog.Content class="max-w-sm">
		<Dialog.Header>
			<Dialog.Title>{title}</Dialog.Title>
			<Dialog.Description>{description}</Dialog.Description>
		</Dialog.Header>

		<Dialog.Footer class="mt-2">
			<Button type="button" variant="outline" onclick={() => onOpenChange(false)} disabled={isDeleting}>
				Cancel
			</Button>
			<Button
				type="button"
				variant="destructive"
				onclick={handleConfirm}
				disabled={isDeleting}
			>
				{#if isDeleting}
					<Loader2Icon class="mr-1.5 h-4 w-4 animate-spin" />
					Deleting…
				{:else}
					<TrashIcon class="mr-1.5 h-4 w-4" />
					Delete
				{/if}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
