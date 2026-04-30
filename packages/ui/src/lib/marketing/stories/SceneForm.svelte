<script lang="ts">
	import { Button } from '$ui/components/ui/button/index.js';
	import type { Scene } from '../types.js';

	interface Props {
		scene?: Scene;
		onSave: (data: { description?: string; durationMs?: number }) => void;
		onCancel: () => void;
		isLoading?: boolean;
	}

	let { scene, onSave, onCancel, isLoading = false }: Props = $props();

	let description = $state(scene?.description ?? '');
	let durationSeconds = $state(scene?.durationMs ? scene.durationMs / 1000 : 5);

	function handleSubmit() {
		onSave({
			description: description.trim() || undefined,
			durationMs: durationSeconds * 1000,
		});
	}
</script>

<form onsubmit|preventDefault={handleSubmit} class="flex flex-col gap-4">
	<div class="flex flex-col gap-1.5">
		<label for="scene-description" class="text-sm font-medium">Description</label>
		<textarea
			id="scene-description"
			class="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
			placeholder="Scene description"
			bind:value={description}
		></textarea>
	</div>

	<div class="flex flex-col gap-1.5">
		<label for="scene-duration" class="text-sm font-medium">Duration (seconds)</label>
		<input
			id="scene-duration"
			type="number"
			min="0.5"
			step="0.5"
			class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
			bind:value={durationSeconds}
		/>
	</div>

	<div class="flex justify-end gap-2">
		<Button type="button" variant="outline" size="sm" onclick={onCancel} disabled={isLoading}>
			Cancel
		</Button>
		<Button type="submit" size="sm" disabled={isLoading}>
			{isLoading ? 'Saving...' : scene ? 'Update Scene' : 'Create Scene'}
		</Button>
	</div>
</form>
