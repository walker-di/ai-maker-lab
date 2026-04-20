<script lang="ts">
  import type { MapEditorModel } from './map-editor.svelte.ts';
  import TilePalette from './TilePalette.svelte';
  import EntityPalette from './EntityPalette.svelte';

  let { model }: { model: MapEditorModel } = $props();
</script>

<div class="palette" data-testid="map-editor-palette">
  <TilePalette {model} />
  <EntityPalette {model} />
</div>

<style>
  .palette {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 0.75rem;
    background: #14172a;
    border-radius: 0.5rem;
    color: #e7e7ee;
    font-size: 0.8rem;
    min-width: 200px;
  }
</style>
