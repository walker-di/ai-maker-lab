<script lang="ts">
	import { Button } from '$ui/components/ui/button/index.js';
	import { Input } from '$ui/components/ui/input/index.js';
	import { Textarea } from '$ui/components/ui/textarea/index.js';
	import { Label } from '$ui/components/ui/label/index.js';
	import * as Dialog from '$ui/components/ui/dialog/index.js';

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		onCreate: (input: { name: string; description?: string }) => void | Promise<void>;
		isLoading?: boolean;
	}
	let { open, onOpenChange, onCreate, isLoading = false }: Props = $props();
	let name = $state('');
	let description = $state('');
	let error = $state('');

	async function submit() {
		error = '';
		if (!name.trim()) { error = 'Storyboard name is required'; return; }
		await onCreate({ name: name.trim(), description: description.trim() || undefined });
		name = '';
		description = '';
	}
</script>

<Dialog.Root {open} onOpenChange={onOpenChange}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Create storyboard</Dialog.Title>
			<Dialog.Description>Name the storyboard before generating frames.</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-4 py-2">
			<div class="space-y-1">
				<Label for="storyboard-name">Name</Label>
				<Input id="storyboard-name" bind:value={name} disabled={isLoading} aria-invalid={!!error} />
				{#if error}<p class="text-sm text-destructive">{error}</p>{/if}
			</div>
			<div class="space-y-1">
				<Label for="storyboard-description">Description</Label>
				<Textarea id="storyboard-description" bind:value={description} disabled={isLoading} rows={3} />
			</div>
		</div>
		<Dialog.Footer>
			<Button type="button" variant="outline" onclick={() => onOpenChange(false)} disabled={isLoading}>Cancel</Button>
			<Button type="button" onclick={submit} disabled={isLoading}>{isLoading ? 'Creating…' : 'Create'}</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
