<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Button, Tooltip, Rts } from 'ui/source';
  import { createRtsPage } from './rts-page.composition.ts';

  const { Runtime } = Rts;
  const { RtsHud, MatchSetup, MapGenerationPanel, MapPreview } = Runtime;

  const model = createRtsPage();

  let canvas = $state<HTMLDivElement | undefined>(undefined);

  $effect(() => {
    if (canvas) model.setMountTarget(canvas);
  });

  onDestroy(() => model.dispose());
</script>

<svelte:head>
  <title>RTS Skirmish</title>
</svelte:head>

<Tooltip.Provider>
  <div class="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-8">
    <header class="flex items-baseline justify-between">
      <h1 class="text-foreground text-3xl font-semibold tracking-tight">RTS Skirmish</h1>
      <p class="text-muted-foreground text-sm">
        {#if model.runActive}
          Match in progress · click units to select · right-click tile to move (mouse handlers wire up later).
        {:else if model.view === 'mapgen'}
          Tweak the generator and preview a new map before saving it to your library.
        {:else}
          Pick a map and difficulty to start a skirmish against the AI.
        {/if}
      </p>
    </header>

    {#if model.errorMessage}
      <p
        class="rounded-2xl border border-red-300/60 bg-red-50 px-5 py-3 text-sm text-red-700"
        data-testid="rts-error"
      >
        {model.errorMessage}
      </p>
    {/if}

    {#if model.view === 'lobby'}
      <section class="grid gap-6 lg:grid-cols-[24rem_1fr]" data-testid="rts-lobby">
        <div class="flex flex-col gap-4">
          {#if model.isLoading && model.catalog.length === 0}
            <p class="text-muted-foreground text-sm">Loading map catalog…</p>
          {:else if model.catalog.length === 0}
            <p class="text-muted-foreground text-sm">No maps available yet.</p>
          {:else}
            <MatchSetup
              maps={model.catalog}
              onStart={(choice) => void model.startMatch(choice)}
              onGenerateMap={() => model.openMapGen()}
            />
          {/if}
          {#if model.lastWinner}
            <p class="text-muted-foreground text-sm" data-testid="rts-last-winner">
              Last match winner: <strong>{model.lastWinner}</strong>
            </p>
          {/if}
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {#each model.catalog as entry (entry.id)}
            <article class="border-border bg-background flex flex-col gap-2 rounded-xl border p-3">
              <header class="flex items-baseline justify-between gap-2">
                <span class="text-foreground font-medium">{entry.metadata.title}</span>
                <span class="text-muted-foreground text-xs uppercase">{entry.source}</span>
              </header>
              <MapPreview map={entry.definition} pixelsPerTile={4} />
              <p class="text-muted-foreground text-xs">
                {entry.definition.size.cols}×{entry.definition.size.rows} ·
                {entry.definition.spawns.length} spawns ·
                {entry.definition.resources.length} resources
              </p>
            </article>
          {/each}
        </div>
      </section>
    {:else if model.view === 'mapgen'}
      <section class="grid gap-6 lg:grid-cols-[24rem_1fr]" data-testid="rts-mapgen-view">
        <div class="flex flex-col gap-4">
          <MapGenerationPanel
            initialParams={model.generationParams}
            onGenerate={(params) => void model.generate(params)}
            onSave={(title, author) => void model.saveGenerated(title, author)}
            lastError={model.mapgenError}
          />
          <Button variant="outline" size="sm" onclick={() => model.closeMapGen()}>
            Back to lobby
          </Button>
        </div>

        <div class="border-border bg-background flex flex-col gap-2 rounded-xl border p-4">
          {#if model.lastGenerated}
            <h2 class="text-lg font-semibold">Preview</h2>
            <MapPreview map={model.lastGenerated.map} pixelsPerTile={6} />
            <p class="text-muted-foreground text-xs">
              Seed {model.lastGenerated.params.seed} ·
              {model.lastGenerated.map.size.cols}×{model.lastGenerated.map.size.rows} ·
              {model.lastGenerated.map.spawns.length} spawns
            </p>
          {:else}
            <p class="text-muted-foreground text-sm">Generate a map to see a preview.</p>
          {/if}
        </div>
      </section>
    {:else}
      <section class="flex flex-col gap-3" data-testid="rts-stage">
        <div class="flex items-center justify-between gap-3">
          <RtsHud model={model.hud} />
          <div class="flex items-center gap-2">
            <Button variant="outline" size="sm" onclick={() => model.togglePause()} disabled={!model.runActive}>
              {model.paused ? 'Resume' : 'Pause'}
            </Button>
            <Button variant="ghost" size="sm" onclick={() => model.leaveMatch()}>
              Leave match
            </Button>
          </div>
        </div>
        <div
          bind:this={canvas}
          class="rts-canvas-host border-border bg-background relative flex aspect-[16/9] w-full items-center justify-center overflow-hidden rounded-2xl border"
          data-testid="rts-canvas"
        ></div>
      </section>
    {/if}
  </div>
</Tooltip.Provider>

<style>
  :global(.rts-canvas-host canvas) {
    image-rendering: pixelated;
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }
</style>
