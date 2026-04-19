<script lang="ts">
	import { Tooltip } from 'ui/source';
	import { createVoxsimLabPage } from './lab-page.composition.ts';

	const model = createVoxsimLabPage();
</script>

<svelte:head>
	<title>Voxsim Lab</title>
</svelte:head>

<Tooltip.Provider>
	<div class="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-8">
		<header class="flex items-baseline justify-between">
			<h1 class="text-foreground text-3xl font-semibold tracking-tight">Voxsim Lab</h1>
			<p class="text-muted-foreground text-sm">
				Browse arenas, agents, and training runs.
			</p>
		</header>

		{#if model.errorMessage}
			<p
				class="rounded-2xl border border-red-300/60 bg-red-50 px-5 py-3 text-sm text-red-700"
				data-testid="voxsim-error"
			>
				{model.errorMessage}
			</p>
		{/if}

		<nav class="flex flex-wrap gap-3 text-sm" data-testid="voxsim-nav">
			<a
				class="border-border bg-background hover:bg-muted/40 rounded-xl border px-3 py-2"
				href="/experiments/voxsim/arena"
			>
				Arenas
			</a>
			<a
				class="border-border bg-background hover:bg-muted/40 rounded-xl border px-3 py-2"
				href="/experiments/voxsim/editor"
			>
				Editor
			</a>
		</nav>

		<section
			class="border-border bg-muted/20 rounded-2xl border p-4"
			data-testid="voxsim-arenas"
		>
			<h2 class="text-foreground mb-3 text-lg font-medium">Arenas</h2>
			{#if model.isLoading && model.arenas.length === 0}
				<p class="text-muted-foreground text-sm">Loading arenas…</p>
			{:else if model.arenas.length === 0}
				<p class="text-muted-foreground text-sm">No arenas yet.</p>
			{:else}
				<ul class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
					{#each model.arenas as arena (arena.id)}
						<li
							class="border-border bg-background rounded-xl border p-3"
							data-testid="voxsim-arena-entry"
							data-arena-id={arena.id}
						>
							<p class="text-foreground font-medium">{arena.metadata.title}</p>
							<p class="text-muted-foreground text-xs uppercase">{arena.source}</p>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section
			class="border-border bg-muted/20 rounded-2xl border p-4"
			data-testid="voxsim-agents"
		>
			<h2 class="text-foreground mb-3 text-lg font-medium">Agents</h2>
			{#if model.agents.length === 0}
				<p class="text-muted-foreground text-sm">No agents created yet.</p>
			{:else}
				<ul class="flex flex-col gap-2">
					{#each model.agents as agent (agent.id)}
						<li
							class="border-border bg-background flex items-center justify-between rounded-xl border p-3"
							data-testid="voxsim-agent-entry"
						>
							<span class="text-foreground font-medium">{agent.name}</span>
							<span class="text-muted-foreground text-xs uppercase">
								{agent.kind} · gen {agent.generation}
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section
			class="border-border bg-muted/20 rounded-2xl border p-4"
			data-testid="voxsim-runs"
		>
			<h2 class="text-foreground mb-3 text-lg font-medium">Training runs</h2>
			{#if model.runs.length === 0}
				<p class="text-muted-foreground text-sm">No training runs yet.</p>
			{:else}
				<ul class="flex flex-col gap-2">
					{#each model.runs as run (run.id)}
						<li
							class="border-border bg-background rounded-xl border p-3"
							data-testid="voxsim-run-entry"
						>
							<a
								href={`/experiments/voxsim/replays/${run.id}`}
								class="text-foreground font-medium hover:underline"
							>
								Run {run.id.slice(0, 8)} · {run.algorithm}
							</a>
							<p class="text-muted-foreground text-xs uppercase">
								{run.status} · episodes {run.totalEpisodes}
							</p>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</div>
</Tooltip.Provider>
