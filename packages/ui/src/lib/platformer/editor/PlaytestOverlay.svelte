<script lang="ts">
  import type { MapEditorModel } from './map-editor.svelte.ts';

  let { model }: { model: MapEditorModel } = $props();

  function onKeydown(e: KeyboardEvent) {
    if (!model.playtest.active) return;
    if (e.key === 'Escape' || e.key === 'Enter') {
      e.preventDefault();
      model.cancelPlaytest();
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if model.playtest.active}
  <div
    class="playtest-overlay"
    data-testid="playtest-overlay"
    role="dialog"
    aria-modal="true"
    aria-label="Playtest mode"
  >
    <div class="panel">
      <p class="title">Playtest mode</p>
      <p class="hint">Editor is paused. Press <kbd>Esc</kbd> or <kbd>Enter</kbd> to return.</p>
      <button type="button" class="dismiss" data-testid="playtest-overlay-dismiss" onclick={() => model.cancelPlaytest()}>
        Close
      </button>
    </div>
  </div>
{/if}

<style>
  .playtest-overlay {
    position: absolute;
    inset: 0;
    z-index: 20;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 1rem;
    background: rgba(10, 12, 22, 0.72);
    backdrop-filter: blur(2px);
  }
  .panel {
    margin-top: 2rem;
    max-width: 22rem;
    border-radius: 0.75rem;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: #1a1d2e;
    color: #e7e7ee;
    padding: 1rem 1.25rem;
    font-size: 0.875rem;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
  }
  .title {
    font-weight: 600;
    margin: 0 0 0.35rem;
  }
  .hint {
    margin: 0 0 0.75rem;
    color: #a8acd0;
    font-size: 0.8rem;
    line-height: 1.4;
  }
  kbd {
    display: inline-block;
    padding: 0.1rem 0.35rem;
    border-radius: 0.25rem;
    border: 1px solid rgba(255, 255, 255, 0.15);
    font-size: 0.72rem;
    font-family: ui-monospace, monospace;
  }
  .dismiss {
    padding: 0.35rem 0.75rem;
    border-radius: 0.35rem;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(70, 89, 215, 0.35);
    color: inherit;
    cursor: pointer;
    font: inherit;
  }
  .dismiss:hover {
    background: rgba(70, 89, 215, 0.55);
  }
</style>
