<script lang="ts">
  import type { MapEditorModel } from './map-editor.svelte.ts';

  let { model }: { model: MapEditorModel } = $props();
</script>

<form class="meta" data-testid="map-editor-meta" onsubmit={(e) => e.preventDefault()}>
  <label>
    <span>Title</span>
    <input
      data-testid="meta-title"
      value={model.metadata.title}
      oninput={(e) => model.setMetadata({ title: (e.currentTarget as HTMLInputElement).value })}
    />
  </label>
  <label>
    <span>Author</span>
    <input
      data-testid="meta-author"
      value={model.metadata.author}
      oninput={(e) => model.setMetadata({ author: (e.currentTarget as HTMLInputElement).value })}
    />
  </label>
  <div class="dims">
    <label>
      <span>Cols</span>
      <input
        type="number"
        min="8" max="200"
        value={model.map.size.cols}
        oninput={(e) => model.applyOperation({ type: 'resizeMap', cols: Number((e.currentTarget as HTMLInputElement).value), rows: model.map.size.rows })}
      />
    </label>
    <label>
      <span>Rows</span>
      <input
        type="number"
        min="8" max="40"
        value={model.map.size.rows}
        oninput={(e) => model.applyOperation({ type: 'resizeMap', cols: model.map.size.cols, rows: Number((e.currentTarget as HTMLInputElement).value) })}
      />
    </label>
  </div>
  <div class="validation" data-testid="map-editor-validation">
    {#if model.validation.errors.length === 0}
      <span class="ok">Valid</span>
    {:else}
      <ul>
        {#each model.validation.errors as err}
          <li>{err.message}</li>
        {/each}
      </ul>
    {/if}
  </div>
</form>

<style>
  .meta {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: 0.75rem;
    background: #14172a;
    border-radius: 0.5rem;
    color: #e7e7ee;
    font-size: 0.8rem;
  }
  label { display: flex; flex-direction: column; gap: 0.2rem; }
  label > span { color: #a8acd0; text-transform: uppercase; font-size: 0.7rem; }
  input {
    padding: 0.3rem 0.45rem;
    border-radius: 0.3rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.05);
    color: inherit;
    font: inherit;
  }
  .dims { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
  .validation { font-size: 0.75rem; }
  .ok { color: #5cd07a; }
  .validation ul { margin: 0; padding-left: 1rem; color: #ff8585; }
</style>
