import { describe, expect, it } from 'bun:test';

import { ReplayPlayer } from './replay-player.js';
import { buildReplayBuffer } from './__test-helpers__/replay-buffer.js';

describe('ReplayPlayer', () => {
  it('initializes the cursor from the replay header', () => {
    const bytes = buildReplayBuffer({ frameCount: 5, policyKind: 'mlp' });
    const player = new ReplayPlayer({ replayRefId: 'r1', bytes, mlpHiddenWidths: [4, 2] });
    const cursor = player.currentCursor;
    expect(cursor.replayRefId).toBe('r1');
    expect(cursor.frameIndex).toBe(0);
    expect(cursor.frameCount).toBe(5);
    expect(cursor.playing).toBe(false);
    expect(cursor.policyKind).toBe('mlp');
  });

  it('seek clamps to bounds and synthesizes an MLP activation frame', () => {
    const bytes = buildReplayBuffer({ frameCount: 3, policyKind: 'mlp' });
    const player = new ReplayPlayer({ replayRefId: 'r1', bytes, mlpHiddenWidths: [3] });
    const snap = player.seek(99);
    expect(player.currentCursor.frameIndex).toBe(2);
    expect(snap.activationFrame.kind).toBe('mlp');
    if (snap.activationFrame.kind !== 'mlp') return;
    expect(snap.activationFrame.hidden[0]).toHaveLength(3);
  });

  it('synthesizes a NEAT activation frame for NEAT replays', () => {
    const bytes = buildReplayBuffer({ policyKind: 'neat' });
    const player = new ReplayPlayer({ replayRefId: 'r1', bytes });
    const snap = player.seek(0);
    expect(snap.activationFrame.kind).toBe('neat');
  });

  it('play/pause/setPlaybackRate update the cursor without reading frames', () => {
    const bytes = buildReplayBuffer();
    const player = new ReplayPlayer({ replayRefId: 'r1', bytes });
    player.play();
    expect(player.currentCursor.playing).toBe(true);
    player.setPlaybackRate(2);
    expect(player.currentCursor.playbackRate).toBe(2);
    player.pause();
    expect(player.currentCursor.playing).toBe(false);
  });

  it('advance does nothing when paused', () => {
    const bytes = buildReplayBuffer({ frameCount: 10, sampleStride: 1 });
    const player = new ReplayPlayer({ replayRefId: 'r1', bytes });
    player.advance(1, 60);
    expect(player.currentCursor.frameIndex).toBe(0);
  });

  it('advance moves the cursor by elapsedSeconds * rate * sampleRateHz when playing', () => {
    const bytes = buildReplayBuffer({ frameCount: 60 });
    const player = new ReplayPlayer({ replayRefId: 'r1', bytes });
    player.play();
    player.setPlaybackRate(1);
    player.advance(0.1, 60);
    expect(player.currentCursor.frameIndex).toBe(6);
  });

  it('advance pauses automatically at the final frame', () => {
    const bytes = buildReplayBuffer({ frameCount: 4 });
    const player = new ReplayPlayer({ replayRefId: 'r1', bytes });
    player.play();
    player.advance(1, 60);
    expect(player.currentCursor.frameIndex).toBe(3);
    expect(player.currentCursor.playing).toBe(false);
  });
});
