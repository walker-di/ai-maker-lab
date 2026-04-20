<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import { Button, Tooltip, Platformer } from 'ui/source';
  import { createPlatformerPage } from './platformer-page.composition.ts';

  const { PlatformerHud } = Platformer;
  const model = createPlatformerPage();

  let canvas = $state<HTMLDivElement | undefined>(undefined);

  $effect(() => {
    if (canvas) {
      model.setMountTarget(canvas);
      untrack(() => {
        if (!model.runActive && model.selectedMapId) {
          void model.selectMap(model.selectedMapId);
        }
      });
    }
  });

  onDestroy(() => model.dispose());
</script>

<svelte:head>
  <title>Platformer Experiment</title>
</svelte:head>

<Tooltip.Provider>
  <div class="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-8">
    <header class="flex items-baseline justify-between">
      <h1 class="text-foreground text-3xl font-semibold tracking-tight">Platformer</h1>
      <p class="text-muted-foreground text-sm">
        {#if model.runActive}
          Running. Use ← → ↑ to move and jump. Press space to attack.
        {:else}
          Pick a level to start.
        {/if}
      </p>
    </header>

    {#if model.errorMessage}
      <p
        class="rounded-2xl border border-red-300/60 bg-red-50 px-5 py-3 text-sm text-red-700"
        data-testid="platformer-error"
      >
        {model.errorMessage}
      </p>
    {/if}

    <section
      class="border-border bg-muted/20 grid gap-4 rounded-2xl border p-4 sm:grid-cols-2 lg:grid-cols-3"
      data-testid="platformer-catalog"
    >
      {#if model.isLoading && model.catalog.length === 0}
        <p class="text-muted-foreground text-sm">Loading catalog…</p>
      {:else if model.catalog.length === 0}
        <p class="text-muted-foreground text-sm">No maps available yet.</p>
      {:else}
        {#each model.catalog as entry (entry.id)}
          <button
            type="button"
            class="border-border bg-background hover:bg-muted/40 data-[selected=true]:border-primary flex flex-col gap-2 rounded-xl border p-3 text-left"
            data-testid="platformer-catalog-entry"
            data-map-id={entry.id}
            data-selected={entry.id === model.selectedMapId}
            onclick={() => void model.selectMap(entry.id)}
          >
            <span class="text-foreground font-medium">{entry.metadata.title}</span>
            <span class="text-muted-foreground text-xs uppercase">{entry.source}</span>
          </button>
        {/each}
      {/if}
    </section>

    <section class="flex flex-col gap-3" data-testid="platformer-stage">
      <div class="flex items-center justify-between">
        <PlatformerHud model={model.hud} />
        <Button variant="outline" size="sm" onclick={() => model.togglePause()} disabled={!model.runActive}>
          {model.paused ? 'Resume' : 'Pause'}
        </Button>
      </div>
      <div
        bind:this={canvas}
        class="platformer-canvas-host border-border bg-background relative flex aspect-[16/9] w-full items-center justify-center overflow-hidden rounded-2xl border"
        data-testid="platformer-canvas"
      ></div>
    </section>

    {#if model.lastResult}
      <p class="text-muted-foreground text-sm" data-testid="platformer-last-result">
        Last run: {model.lastResult.outcome} · score {model.lastResult.score} · coins {model.lastResult.coins}
      </p>
    {/if}
  </div>
</Tooltip.Provider>

<style>
  :global(.platformer-canvas-host canvas) {
    image-rendering: pixelated;
    image-rendering: crisp-edges;
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }
</style>
