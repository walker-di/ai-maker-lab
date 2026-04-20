<script lang="ts">
  import type { MapEditorModel } from './map-editor.svelte.ts';
  import type { EditorToolKind } from './operations.ts';

  let { model }: { model: MapEditorModel } = $props();

  const tools: { id: EditorToolKind; label: string }[] = [
    { id: 'brush', label: 'Brush' },
    { id: 'rectangle', label: 'Rect' },
    { id: 'fill', label: 'Fill' },
    { id: 'eraser', label: 'Erase' },
    { id: 'entity', label: 'Entity' },
    { id: 'spawn', label: 'Spawn' },
    { id: 'goal', label: 'Goal' },
    { id: 'pan', label: 'Pan' },
  ];
</script>

<div class="toolbar" data-testid="map-editor-toolbar">
  <div class="group">
    {#each tools as tool}
      <button
        type="button"
        class="tool"
        class:active={model.selectedTool === tool.id}
        data-testid={`tool-${tool.id}`}
        onclick={() => model.setTool(tool.id)}
      >{tool.label}</button>
    {/each}
  </div>
  <div class="group">
    <button type="button" data-testid="editor-undo" onclick={() => model.undo()}>Undo</button>
    <button type="button" data-testid="editor-redo" onclick={() => model.redo()}>Redo</button>
  </div>
  <div class="group">
    <button type="button" data-testid="editor-save" onclick={() => model.requestSave()}>Save</button>
    <button
      type="button"
      data-testid="editor-playtest"
      onclick={() => model.enterPlaytest()}
      disabled={!model.canPlaytest()}
    >Playtest</button>
    {#if model.playtest.active}
      <button type="button" data-testid="editor-stop-playtest" onclick={() => model.exitPlaytest()}>Stop</button>
    {/if}
  </div>
</div>

<style>
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    background: #1f2233;
    border-radius: 0.5rem;
    color: #e7e7ee;
    font-size: 0.85rem;
  }
  .group { display: inline-flex; gap: 0.25rem; align-items: center; }
  button {
    padding: 0.25rem 0.6rem;
    border-radius: 0.35rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.05);
    color: inherit;
    cursor: pointer;
    font: inherit;
  }
  button:hover { background: rgba(255, 255, 255, 0.12); }
  button.active { background: #4659d7; border-color: #4659d7; color: #fff; }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
