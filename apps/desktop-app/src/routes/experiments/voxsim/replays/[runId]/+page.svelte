<script lang="ts">
	import { Tooltip } from 'ui/source';
	import { page } from '$app/stores';
	import { createVoxsimReplayPage } from '../../replay-page.composition.ts';

	const runId = $derived($page.params.runId ?? '');
	const model = $derived.by(() => createVoxsimReplayPage(runId));
</script>

<svelte:head>
	<title>Voxsim Replay</title>
</svelte:head>

<Tooltip.Provider>
	<div class="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-8">
		<header class="flex items-baseline justify-between">
			<h1 class="text-foreground text-3xl font-semibold tracking-tight">Replays</h1>
			<a class="text-muted-foreground text-sm hover:underline" href="/experiments/voxsim">
				Back to lab
			</a>
		</header>

		{#if model.errorMessage}
			<p
				class="rounded-2xl border border-red-300/60 bg-red-50 px-5 py-3 text-sm text-red-700"
				data-testid="voxsim-replay-error"
			>
				{model.errorMessage}
			</p>
		{/if}

		{#if model.run}
			{@const run = model.run}
			<section
				class="border-border bg-muted/20 rounded-2xl border p-4"
				data-testid="voxsim-run-summary"
			>
				<h2 class="text-foreground text-lg font-medium">
					Run {run.id.slice(0, 8)}
				</h2>
				<p class="text-muted-foreground text-sm uppercase">
					{run.algorithm} · {run.status} · episodes {run.totalEpisodes} · gens {run.totalGenerations}
				</p>
			</section>
		{/if}

		<section
			class="grid gap-6 lg:grid-cols-[280px_1fr]"
			data-testid="voxsim-replay-detail"
		>
			<aside
				class="border-border bg-muted/20 rounded-2xl border p-3"
				data-testid="voxsim-replay-list"
			>
				<h3 class="text-foreground mb-2 text-sm font-medium">Episodes</h3>
				{#if model.isLoading && model.episodes.length === 0}
					<p class="text-muted-foreground text-sm">Loading…</p>
				{:else if model.episodes.length === 0}
					<p class="text-muted-foreground text-sm">No episodes recorded.</p>
				{:else}
					<ul class="flex flex-col gap-1">
						{#each model.episodes as episode (episode.id)}
							<li>
								<button
									type="button"
									class="border-border bg-background hover:bg-muted/40 data-[selected=true]:border-primary w-full rounded-xl border p-2 text-left text-sm"
									data-testid="voxsim-replay-list-entry"
									data-episode-id={episode.id}
									data-selected={episode.id === model.selectedEpisodeId}
									onclick={() => void model.selectEpisode(episode.id)}
								>
									<span class="text-foreground block font-medium">
										Episode {episode.id.slice(0, 8)}
									</span>
									<span class="text-muted-foreground text-xs uppercase">
										reward {episode.totalReward.toFixed(2)} · steps {episode.steps}
									</span>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</aside>

			<article
				class="border-border bg-background rounded-2xl border p-4"
				data-testid="voxsim-replay-viewer"
			>
				{#if model.replay}
					{@const replay = model.replay}
					<h3 class="text-foreground text-lg font-medium">Replay {replay.id.slice(0, 8)}</h3>
					<dl
						class="text-muted-foreground mt-3 grid grid-cols-2 gap-2 text-xs uppercase"
					>
						<div>
							<dt>Episode</dt>
							<dd class="text-foreground normal-case">{replay.episodeId.slice(0, 8)}</dd>
						</div>
						<div>
							<dt>Frames</dt>
							<dd class="text-foreground normal-case">{replay.frames}</dd>
						</div>
						<div>
							<dt>Bytes</dt>
							<dd class="text-foreground normal-case">{replay.bytes.byteLength}</dd>
						</div>
						<div>
							<dt>Created</dt>
							<dd class="text-foreground normal-case">{replay.createdAt}</dd>
						</div>
					</dl>
				{:else}
					<p class="text-muted-foreground text-sm">Select an episode to view its replay.</p>
				{/if}
			</article>
		</section>

		<section
			class="border-border bg-muted/20 rounded-2xl border p-4"
			data-testid="voxsim-checkpoints"
		>
			<h3 class="text-foreground mb-2 text-sm font-medium">Checkpoints</h3>
			{#if model.checkpoints.length === 0}
				<p class="text-muted-foreground text-sm">No checkpoints yet.</p>
			{:else}
				<ul class="flex flex-col gap-2">
					{#each model.checkpoints as checkpoint (checkpoint.id)}
						<li
							class="border-border bg-background rounded-xl border p-3 text-sm"
							data-testid="voxsim-checkpoint-entry"
						>
							<p class="text-foreground font-medium">{checkpoint.id.slice(0, 12)}</p>
							<p class="text-muted-foreground text-xs uppercase">
								gen {checkpoint.generation} · score {checkpoint.score?.toFixed(2) ?? '–'} · {checkpoint.weights.byteLength} bytes
							</p>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</div>
</Tooltip.Provider>
