<script lang="ts">
	import { Button } from '$ui/components/ui/button/index.js';
	import { Textarea } from '$ui/components/ui/textarea/index.js';
	import { Input } from '$ui/components/ui/input/index.js';
	import { Label } from '$ui/components/ui/label/index.js';
	import * as Dialog from '$ui/components/ui/dialog/index.js';

	interface Props { open: boolean; onOpenChange: (open: boolean) => void; onGenerate: (input: { prompt: string; count: number }) => void | Promise<void>; isLoading?: boolean; }
	let { open, onOpenChange, onGenerate, isLoading = false }: Props = $props();
	let prompt = $state('');
	let count = $state(3);
	let error = $state('');
	async function submit() {
		error = '';
		if (!prompt.trim()) { error = 'Prompt is required'; return; }
		const n = Number(count);
		if (!Number.isFinite(n) || n < 1 || n > 20 || !Number.isInteger(n)) { error = 'Frame count must be a whole number between 1 and 20'; return; }
		await onGenerate({ prompt: prompt.trim(), count: n });
	}
</script>

<Dialog.Root {open} onOpenChange={onOpenChange}>
	<Dialog.Content>
		<Dialog.Header><Dialog.Title>Generate frames</Dialog.Title><Dialog.Description>Create ordered frames from a story prompt.</Dialog.Description></Dialog.Header>
		<div class="space-y-4 py-2">
			<div class="space-y-1"><Label for="frame-prompt">Prompt</Label><Textarea id="frame-prompt" bind:value={prompt} rows={5} disabled={isLoading} />{#if error}<p class="text-sm text-destructive">{error}</p>{/if}</div>
			<div class="space-y-1"><Label for="frame-count">Frame count</Label><Input id="frame-count" type="number" min="1" max="20" bind:value={count} disabled={isLoading} /></div>
		</div>
		<Dialog.Footer><Button type="button" variant="outline" onclick={() => onOpenChange(false)} disabled={isLoading}>Cancel</Button><Button type="button" onclick={submit} disabled={isLoading}>{isLoading ? 'Generating…' : 'Generate'}</Button></Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
