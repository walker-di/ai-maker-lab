<script lang="ts">
  import type { InspectorReplayCursor } from '../types.js';

  let {
    cursor,
    onSeek,
    onPlay,
    onPause,
    onSetRate,
  }: {
    cursor: InspectorReplayCursor | null;
    onSeek: (frameIndex: number) => void;
    onPlay: () => void;
    onPause: () => void;
    onSetRate: (rate: number) => void;
  } = $props();

  const RATES = [0.25, 0.5, 1, 2, 4];
</script>

<div class="replay-viewer" data-testid="replay-viewer">
  <header>
    <span class="label">Replay</span>
    <span class="meta">
      {#if cursor}
        {cursor.policyKind} · frame {cursor.frameIndex + 1}/{cursor.frameCount}
      {:else}
        no replay
      {/if}
    </span>
  </header>
  {#if cursor}
    <input
      type="range"
      min="0"
      max={Math.max(0, cursor.frameCount - 1)}
      value={cursor.frameIndex}
      oninput={(event) => onSeek(Number((event.target as HTMLInputElement).value))}
    />
    <div class="controls">
      {#if cursor.playing}
        <button type="button" onclick={onPause}>Pause</button>
      {:else}
        <button type="button" onclick={onPlay}>Play</button>
      {/if}
      <select
        value={cursor.playbackRate}
        onchange={(event) => onSetRate(Number((event.target as HTMLSelectElement).value))}
      >
        {#each RATES as rate (rate)}
          <option value={rate}>{rate}x</option>
        {/each}
      </select>
    </div>
  {/if}
</div>

<style>
  .replay-viewer {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    background: rgba(15, 20, 30, 0.85);
    border-radius: 0.5rem;
    padding: 0.75rem;
    color: #d6d6df;
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 0.8rem;
  }
  header {
    display: flex;
    justify-content: space-between;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-size: 0.7rem;
    color: #8b8fa0;
  }
  .label {
    color: #ffffff;
  }
  input[type='range'] {
    width: 100%;
  }
  .controls {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  button {
    background: rgba(8, 10, 18, 0.6);
    color: inherit;
    border: none;
    padding: 0.3rem 0.75rem;
    border-radius: 0.3rem;
    cursor: pointer;
  }
  button:hover {
    background: rgba(122, 200, 255, 0.18);
  }
  select {
    background: rgba(8, 10, 18, 0.6);
    color: inherit;
    border: none;
    padding: 0.3rem 0.5rem;
    border-radius: 0.3rem;
  }
</style>
