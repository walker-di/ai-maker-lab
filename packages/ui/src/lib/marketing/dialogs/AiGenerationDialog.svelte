<script lang="ts">
	import { Button } from '$ui/components/ui/button/index.js';
	import { Textarea } from '$ui/components/ui/textarea/index.js';
	import * as Dialog from '$ui/components/ui/dialog/index.js';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		title: string;
		description?: string;
		isGenerating?: boolean;
		onGenerate: () => void | Promise<void>;
		result?: string;
	}

	let {
		open,
		onOpenChange,
		title,
		description,
		isGenerating = false,
		onGenerate,
		result,
	}: Props = $props();

	async function handleGenerate() {
		await onGenerate();
	}
</script>

<Dialog.Root {open} onOpenChange={onOpenChange}>
	<Dialog.Content class="max-w-lg">
		<Dialog.Header>
			<Dialog.Title>{title}</Dialog.Title>
			{#if description}
				<Dialog.Description>{description}</Dialog.Description>
			{/if}
		</Dialog.Header>

		<div class="flex flex-col gap-4 py-2">
			{#if result}
				<div class="space-y-1">
					<p class="text-sm font-medium">Result</p>
					<Textarea
						value={result}
						readonly
						rows={8}
						class="bg-muted/50 font-mono text-xs"
					/>
				</div>
			{/if}
		</div>

		<Dialog.Footer>
			<Button type="button" variant="outline" onclick={() => onOpenChange(false)} disabled={isGenerating}>
				Close
			</Button>
			<Button type="button" onclick={handleGenerate} disabled={isGenerating}>
				{#if isGenerating}
					<Loader2Icon class="mr-1.5 h-4 w-4 animate-spin" />
					Generating…
				{:else}
					<SparklesIcon class="mr-1.5 h-4 w-4" />
					Generate
				{/if}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
