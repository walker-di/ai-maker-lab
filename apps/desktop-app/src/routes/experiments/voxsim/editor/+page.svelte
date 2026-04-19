<script lang="ts">
	import { Tooltip } from 'ui/source';
	import { createVoxsimEditorPage } from '../editor-page.composition.ts';

	const model = createVoxsimEditorPage();
</script>

<svelte:head>
	<title>Voxsim Editor</title>
</svelte:head>

<Tooltip.Provider>
	<div class="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-8">
		<header class="flex items-baseline justify-between">
			<h1 class="text-foreground text-3xl font-semibold tracking-tight">Voxsim Editor</h1>
			<a class="text-muted-foreground text-sm hover:underline" href="/experiments/voxsim">
				Back to lab
			</a>
		</header>

		{#if model.errorMessage}
			<p
				class="rounded-2xl border border-red-300/60 bg-red-50 px-5 py-3 text-sm text-red-700"
				data-testid="voxsim-editor-error"
			>
				{model.errorMessage}
			</p>
		{/if}

		<section
			class="border-border bg-muted/20 rounded-2xl border p-4"
			data-testid="voxsim-editor-list"
		>
			<h2 class="text-foreground mb-3 text-lg font-medium">Your arenas</h2>
			{#if model.userArenas.length === 0}
				<p class="text-muted-foreground text-sm">
					No user arenas yet. Duplicate a built-in arena from the arenas page to start editing.
				</p>
			{:else}
				<ul class="grid gap-2 sm:grid-cols-2">
					{#each model.userArenas as arena (arena.id)}
						<li
							class="border-border bg-background flex items-center justify-between rounded-xl border p-3"
							data-testid="voxsim-editor-entry"
						>
							<div>
								<p class="text-foreground font-medium">{arena.metadata.title}</p>
								<p class="text-muted-foreground text-xs uppercase">
									{arena.inheritsFromBuiltInId ? `from ${arena.inheritsFromBuiltInId}` : 'custom'}
								</p>
							</div>
							<div class="flex gap-2">
								<button
									type="button"
									class="border-border bg-background hover:bg-muted/40 rounded-lg border px-3 py-1 text-xs"
									onclick={() => model.selectForEdit(arena)}
								>
									Edit
								</button>
								<button
									type="button"
									class="rounded-lg border border-red-300/60 bg-red-50 px-3 py-1 text-xs text-red-700 hover:bg-red-100"
									onclick={() => void model.deleteArena(arena.id)}
								>
									Delete
								</button>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		{#if model.editing}
			{@const editing = model.editing}
			<section
				class="border-border bg-background rounded-2xl border p-4"
				data-testid="voxsim-editor-detail"
			>
				<h2 class="text-foreground text-lg font-medium">Editing: {editing.metadata.title}</h2>
				<p class="text-muted-foreground mt-2 text-sm">
					Full visual editing is not yet implemented in v1. Use the arena page to inspect details.
				</p>
				<button
					type="button"
					class="border-border bg-background hover:bg-muted/40 mt-3 rounded-lg border px-3 py-1 text-xs"
					onclick={() => model.selectForEdit(null)}
				>
					Close
				</button>
			</section>
		{/if}
	</div>
</Tooltip.Provider>
