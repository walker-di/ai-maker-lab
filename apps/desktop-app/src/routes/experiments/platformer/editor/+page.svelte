<script lang="ts">
  import { Button, Tooltip, Platformer } from 'ui/source';
  import { createEditorPage } from './editor-page.composition.ts';

  const { MapEditorCanvas, MapEditorToolbar, MapEditorPalette, MapMetadataForm } = Platformer;
  const model = createEditorPage();
</script>

<svelte:head>
  <title>Platformer Editor</title>
</svelte:head>

<Tooltip.Provider>
  <div class="mx-auto flex min-h-screen max-w-[1200px] flex-col gap-4 px-4 py-6">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-baseline gap-3">
        <h1 class="text-foreground text-2xl font-semibold tracking-tight">Platformer Editor</h1>
        {#if model.dirty}
          <span class="text-amber-500" data-testid="editor-dirty-badge">unsaved</span>
        {/if}
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onclick={() => model.resetToEmpty()}>New</Button>
        <Button size="sm" variant="outline" onclick={() => void model.saveAs()} disabled={model.saving}>
          Save as
        </Button>
        <Button size="sm" onclick={() => void model.save()} disabled={model.saving} data-testid="editor-save-btn">
          {model.saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </header>

    {#if model.errorMessage}
      <p
        class="rounded-2xl border border-red-300/60 bg-red-50 px-5 py-3 text-sm text-red-700"
        data-testid="editor-error"
      >
        {model.errorMessage}
      </p>
    {/if}
    {#if model.status}
      <p class="text-muted-foreground text-sm" data-testid="editor-status">{model.status}</p>
    {/if}

    <MapEditorToolbar model={model.editor} />

    <div class="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)_260px]">
      <aside class="flex flex-col gap-4">
        <MapEditorPalette model={model.editor} />
        <MapMetadataForm model={model.editor} />
        <section
          class="border-border bg-muted/20 flex flex-col gap-2 rounded-xl border p-3 text-sm"
          data-testid="editor-catalog"
        >
          <h2 class="text-foreground font-medium">Maps</h2>
          {#if model.isLoading && model.catalog.length === 0}
            <p class="text-muted-foreground text-xs">Loading…</p>
          {:else if model.catalog.length === 0}
            <p class="text-muted-foreground text-xs">No saved maps yet.</p>
          {:else}
            <ul class="flex flex-col gap-1">
              {#each model.catalog as entry (entry.id)}
                <li class="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    class="text-foreground hover:text-primary truncate text-left"
                    data-testid="editor-catalog-entry"
                    data-map-id={entry.id}
                    onclick={() => void model.loadEntry(entry.id)}
                  >
                    {entry.metadata.title}
                  </button>
                  {#if entry.source === 'builtin'}
                    <button
                      type="button"
                      class="text-muted-foreground hover:text-primary text-xs"
                      onclick={() => void model.duplicate(entry.id)}
                    >duplicate</button>
                  {/if}
                </li>
              {/each}
            </ul>
          {/if}
        </section>
      </aside>

      <div class="border-border bg-background relative h-[60vh] min-h-[480px] overflow-hidden rounded-xl border">
        <MapEditorCanvas model={model.editor} />
      </div>

      <aside
        class="border-border bg-muted/20 flex flex-col gap-2 rounded-xl border p-3 text-sm"
        data-testid="editor-validation"
      >
        <h2 class="text-foreground font-medium">Validation</h2>
        {#if model.editor.validation.errors.length === 0 && model.editor.validation.warnings.length === 0}
          <p class="text-muted-foreground text-xs">Map is valid.</p>
        {:else}
          {#each model.editor.validation.errors as issue}
            <p class="text-xs text-red-500">{issue.message}</p>
          {/each}
          {#each model.editor.validation.warnings as issue}
            <p class="text-xs text-amber-500">{issue.message}</p>
          {/each}
        {/if}
      </aside>
    </div>
  </div>
</Tooltip.Provider>
