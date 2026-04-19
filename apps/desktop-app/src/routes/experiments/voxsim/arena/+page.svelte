<script lang="ts">
	import { Tooltip } from 'ui/source';
	import { createVoxsimArenaPage } from '../arena-page.composition.ts';

	const model = createVoxsimArenaPage();
</script>

<svelte:head>
	<title>Voxsim Arena</title>
</svelte:head>

<Tooltip.Provider>
	<div class="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-8">
		<header class="flex items-baseline justify-between">
			<h1 class="text-foreground text-3xl font-semibold tracking-tight">Voxsim Arenas</h1>
			<a class="text-muted-foreground text-sm hover:underline" href="/experiments/voxsim">
				Back to lab
			</a>
		</header>

		{#if model.errorMessage}
			<p
				class="rounded-2xl border border-red-300/60 bg-red-50 px-5 py-3 text-sm text-red-700"
				data-testid="voxsim-arena-error"
			>
				{model.errorMessage}
			</p>
		{/if}

		<section class="grid gap-6 lg:grid-cols-[280px_1fr]" data-testid="voxsim-arena-detail">
			<aside
				class="border-border bg-muted/20 rounded-2xl border p-3"
				data-testid="voxsim-arena-list"
			>
				{#if model.isLoading && model.catalog.length === 0}
					<p class="text-muted-foreground text-sm">Loading…</p>
				{:else if model.catalog.length === 0}
					<p class="text-muted-foreground text-sm">No arenas.</p>
				{:else}
					<ul class="flex flex-col gap-1">
						{#each model.catalog as entry (entry.id)}
							<li>
								<button
									type="button"
									class="border-border bg-background hover:bg-muted/40 data-[selected=true]:border-primary w-full rounded-xl border p-2 text-left text-sm"
									data-testid="voxsim-arena-list-entry"
									data-arena-id={entry.id}
									data-selected={entry.id === model.selectedId}
									onclick={() => void model.selectArena(entry.id)}
								>
									<span class="text-foreground block font-medium">{entry.metadata.title}</span>
									<span class="text-muted-foreground text-xs uppercase">{entry.source}</span>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</aside>

			<article
				class="border-border bg-background rounded-2xl border p-4"
				data-testid="voxsim-arena-viewer"
			>
				{#if model.selectedArena}
					{@const arena = model.selectedArena}
					<h2 class="text-foreground text-xl font-medium">{arena.metadata.title}</h2>
					<p class="text-muted-foreground mt-1 text-xs">by {arena.metadata.author}</p>
					<dl
						class="text-muted-foreground mt-4 grid grid-cols-2 gap-2 text-xs uppercase"
					>
						<div>
							<dt>Source</dt>
							<dd class="text-foreground normal-case">{arena.source}</dd>
						</div>
						<div>
							<dt>Editable</dt>
							<dd class="text-foreground normal-case">{arena.isEditable}</dd>
						</div>
						<div>
							<dt>Chunks</dt>
							<dd class="text-foreground normal-case">{arena.definition.chunks.length}</dd>
						</div>
						<div>
							<dt>Gravity Y</dt>
							<dd class="text-foreground normal-case">
								{arena.definition.gravity.y}
							</dd>
						</div>
					</dl>
				{:else}
					<p class="text-muted-foreground text-sm">Select an arena to view details.</p>
				{/if}
			</article>
		</section>
	</div>
</Tooltip.Provider>
