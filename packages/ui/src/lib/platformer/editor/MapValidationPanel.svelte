<script lang="ts">
  import type { MapEditorModel } from './map-editor.svelte.ts';

  let { model }: { model: MapEditorModel } = $props();
</script>

<section
  class="border-border bg-muted/20 flex flex-col gap-2 rounded-xl border p-3 text-sm"
  data-testid="editor-validation"
>
  <h2 class="text-foreground font-medium">Validation</h2>
  {#if model.validation.errors.length === 0 && model.validation.warnings.length === 0}
    <p class="text-muted-foreground text-xs">Map is valid.</p>
  {:else}
    {#each model.validation.errors as issue}
      <p class="text-xs text-red-500">{issue.message}</p>
    {/each}
    {#each model.validation.warnings as issue}
      <p class="text-xs text-amber-500">{issue.message}</p>
    {/each}
  {/if}
</section>
