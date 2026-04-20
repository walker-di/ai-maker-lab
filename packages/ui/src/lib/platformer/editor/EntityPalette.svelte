<script lang="ts">
  import type { MapEditorModel } from './map-editor.svelte.ts';
  import { PLACEABLE_ENTITY_KINDS, type EntityKind } from '../types.js';
  import { DEFAULT_BUNDLE } from '../engine/assets.js';

  let { model }: { model: MapEditorModel } = $props();
</script>

<div class="section">
  <header>Entities</header>
  <div class="grid">
    {#each PLACEABLE_ENTITY_KINDS as kind (kind)}
      {@const place = DEFAULT_BUNDLE.entities[kind as EntityKind]}
      <button
        type="button"
        class="tile"
        class:active={model.selectedEntity === kind && model.selectedTool === 'entity'}
        data-testid={`palette-entity-${kind}`}
        onclick={() => {
          model.setSelectedEntity(kind as EntityKind);
          model.setTool('entity');
        }}
      >
        <span
          class="swatch"
          style="background:#{place.tint.toString(16).padStart(6, '0')}; border-radius:{place.shape === 'roundRect'
            ? '4px'
            : place.shape === 'circle'
              ? '50%'
              : '0'}"
        ></span>
        <span class="name">{kind}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .section header {
    font-weight: 600;
    margin-bottom: 0.4rem;
    color: #a8acd0;
    text-transform: uppercase;
    font-size: 0.7rem;
    letter-spacing: 0.06em;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.4rem;
  }
  .tile {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.3rem 0.4rem;
    border-radius: 0.35rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.04);
    color: inherit;
    cursor: pointer;
    font: inherit;
    text-align: left;
  }
  .tile:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  .tile.active {
    border-color: #4659d7;
    background: rgba(70, 89, 215, 0.18);
  }
  .swatch {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }
  .name {
    font-family: ui-monospace, monospace;
    font-size: 0.7rem;
  }
</style>
