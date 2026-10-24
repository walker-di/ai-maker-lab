<script module lang="ts">
  export interface ReplayBarActions {
    onEnter: (source: 'last' | 'best' | 'recent') => void;
    onExit: () => void;
    onTogglePlay: () => void;
    onSeek: (time: number) => void;
    onSpeed: (speed: number) => void;
    onToggleGhost: () => void;
  }
</script>

<script lang="ts">
  import Play from '@lucide/svelte/icons/play';
  import Pause from '@lucide/svelte/icons/pause';
  import X from '@lucide/svelte/icons/x';
  import Ghost from '@lucide/svelte/icons/ghost';
  import History from '@lucide/svelte/icons/history';
  import type { RacingHudReplayState } from '../RacingHud.svelte.ts';

  let { replay, actions }: { replay: RacingHudReplayState; actions: ReplayBarActions } = $props();

  const speeds = [0.25, 0.5, 1, 2];

  function formatTime(s: number): string {
    const total = Math.max(0, s);
    const minutes = Math.floor(total / 60);
    const seconds = total - minutes * 60;
    return `${minutes}:${seconds.toFixed(2).padStart(5, '0')}`;
  }

  function handleSeek(event: Event): void {
    const target = event.currentTarget;
    if (!(target instanceof HTMLInputElement)) return;
    actions.onSeek(target.valueAsNumber);
  }

  const sourceLabel = $derived(
    replay.source === 'best' ? 'Session best' : replay.source === 'last' ? 'Last lap' : 'Last 60 s',
  );
</script>

{#if replay.mode === 'replay'}
  <div class="panel replay-bar active" data-testid="hud-replay">
    <span class="tag">Replay</span>
    <span class="source">{sourceLabel}</span>
    <button
      type="button"
      class="icon-btn"
      aria-label={replay.playing ? 'Pause replay' : 'Play replay'}
      data-testid="replay-play"
      onclick={actions.onTogglePlay}
    >
      {#if replay.playing}<Pause size={14} />{:else}<Play size={14} />{/if}
    </button>
    <input
      class="scrub"
      type="range"
      min="0"
      max={replay.duration}
      step="0.01"
      value={replay.time}
      aria-label="Replay position"
      data-testid="replay-scrub"
      oninput={handleSeek}
    />
    <span class="time" data-testid="replay-time">{formatTime(replay.time)} / {formatTime(replay.duration)}</span>
    <div class="speeds" role="group" aria-label="Playback speed">
      {#each speeds as s (s)}
        <button type="button" class="chip" class:on={replay.speed === s} onclick={() => actions.onSpeed(s)}>{s}×</button>
      {/each}
    </div>
    <button type="button" class="icon-btn" aria-label="Exit replay" data-testid="replay-exit" onclick={actions.onExit}>
      <X size={14} />
    </button>
  </div>
{:else}
  <div class="panel replay-bar" data-testid="hud-replay">
    <History size={14} class="muted-icon" />
    <button type="button" class="chip" disabled={!replay.available.last} onclick={() => actions.onEnter('last')}>Last lap</button>
    <button type="button" class="chip" disabled={!replay.available.best} title="Fastest lap driven this session (the HUD lap card shows your all-time best)"
      onclick={() => actions.onEnter('best')}>Session best</button>
    <button type="button" class="chip" disabled={!replay.available.recent} onclick={() => actions.onEnter('recent')}>Last 60 s</button>
    <span class="divider"></span>
    <button
      type="button"
      class="chip"
      class:on={replay.ghostEnabled}
      aria-pressed={replay.ghostEnabled}
      data-testid="replay-ghost"
      title="Race against this session's best lap"
      onclick={actions.onToggleGhost}
    >
      <Ghost size={12} /> Ghost
    </button>
  </div>
{/if}

<style>
  .replay-bar {
    position: absolute;
    top: 112px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    font-size: 11px;
    pointer-events: auto;
    color: rgba(230, 236, 242, 0.75);
  }
  .replay-bar.active {
    border-color: rgba(255, 112, 112, 0.45);
  }
  .tag {
    color: #ff7070;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    font-size: 10px;
  }
  .source {
    color: #f5f8fc;
  }
  .time {
    font-variant-numeric: tabular-nums;
    color: #77cfff;
    min-width: 108px;
  }
  .scrub {
    width: 220px;
    accent-color: #77cfff;
  }
  .speeds {
    display: flex;
    gap: 4px;
  }
  .chip,
  .icon-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: 1px solid rgba(221, 238, 255, 0.14);
    background: rgba(255, 255, 255, 0.04);
    color: inherit;
    border-radius: 999px;
    padding: 3px 9px;
    font-size: 11px;
    cursor: pointer;
  }
  .icon-btn {
    padding: 4px;
  }
  .chip:hover:not(:disabled),
  .icon-btn:hover {
    border-color: rgba(118, 203, 255, 0.4);
    color: #f5f8fc;
  }
  .chip.on {
    border-color: rgba(118, 203, 255, 0.6);
    color: #77cfff;
  }
  .chip:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .divider {
    width: 1px;
    height: 16px;
    background: rgba(221, 238, 255, 0.14);
  }
  .replay-bar :global(.muted-icon) {
    color: rgba(230, 236, 242, 0.45);
  }
</style>
