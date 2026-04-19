import { describe, expect, it } from 'bun:test';

import { REPLAY_FLOATS_PER_SEGMENT } from './replay.js';
import { ReplayBuffer, decodeReplay } from './replay-codec.js';

describe('ReplayBuffer + decodeReplay', () => {
  it('round-trips a small frame stream byte-for-byte', () => {
    const segmentCount = 3;
    const actionWidth = 2;
    const observationWidth = 4;
    const frameCount = 5;
    const buffer = new ReplayBuffer({
      bodyDnaId: 'body-1',
      brainDnaId: 'brain-1',
      arenaId: 'flat-arena',
      policyKind: 'mlp',
      segmentCount,
      actionWidth,
      observationWidth,
      sampleStride: 2,
      frameCapacity: frameCount,
    });

    const transforms: Float32Array[] = [];
    const actions: Float32Array[] = [];
    const observations: Float32Array[] = [];

    for (let i = 0; i < frameCount; i++) {
      const t = new Float32Array(segmentCount * REPLAY_FLOATS_PER_SEGMENT);
      for (let j = 0; j < t.length; j++) t[j] = i * 100 + j * 0.25;
      const a = new Float32Array(actionWidth);
      for (let j = 0; j < a.length; j++) a[j] = -i + j * 0.5;
      const o = new Float32Array(observationWidth);
      for (let j = 0; j < o.length; j++) o[j] = Math.sin(i + j);
      transforms.push(t);
      actions.push(a);
      observations.push(o);
      buffer.write(i * 2, t, a, o);
    }

    const encoded = buffer.finalize();
    const { header, frames } = decodeReplay(encoded);

    expect(header.bodyDnaId).toBe('body-1');
    expect(header.brainDnaId).toBe('brain-1');
    expect(header.arenaId).toBe('flat-arena');
    expect(header.policyKind).toBe('mlp');
    expect(header.frameCount).toBe(frameCount);
    expect(header.segmentCount).toBe(segmentCount);
    expect(header.actionWidth).toBe(actionWidth);
    expect(header.observationWidth).toBe(observationWidth);
    expect(header.sampleStride).toBe(2);
    expect(frames.length).toBe(frameCount);

    for (let i = 0; i < frameCount; i++) {
      const f = frames[i]!;
      expect(f.stepIndex).toBe(i * 2);
      expect(Array.from(f.transforms)).toEqual(Array.from(transforms[i]!));
      expect(Array.from(f.actions)).toEqual(Array.from(actions[i]!));
      expect(Array.from(f.observations)).toEqual(Array.from(observations[i]!));
    }
  });

  it('finalize truncates to frames written so far', () => {
    const buffer = new ReplayBuffer({
      bodyDnaId: 'b',
      brainDnaId: 'br',
      arenaId: 'a',
      policyKind: 'neat',
      segmentCount: 1,
      actionWidth: 1,
      observationWidth: 1,
      sampleStride: 1,
      frameCapacity: 4,
    });
    buffer.write(
      7,
      new Float32Array(REPLAY_FLOATS_PER_SEGMENT),
      new Float32Array(1),
      new Float32Array(1),
    );
    const encoded = buffer.finalize();
    const { header, frames } = decodeReplay(encoded);
    expect(header.frameCount).toBe(1);
    expect(frames.length).toBe(1);
    expect(frames[0]!.stepIndex).toBe(7);
  });

  it('throws on dimension mismatch', () => {
    const buffer = new ReplayBuffer({
      bodyDnaId: 'b',
      brainDnaId: 'br',
      arenaId: 'a',
      policyKind: 'neatLstm',
      segmentCount: 2,
      actionWidth: 1,
      observationWidth: 1,
      sampleStride: 1,
      frameCapacity: 1,
    });
    expect(() =>
      buffer.write(0, new Float32Array(7), new Float32Array(1), new Float32Array(1)),
    ).toThrow();
  });

  it('throws when capacity is exceeded', () => {
    const buffer = new ReplayBuffer({
      bodyDnaId: 'b',
      brainDnaId: 'br',
      arenaId: 'a',
      policyKind: 'mlp',
      segmentCount: 0,
      actionWidth: 0,
      observationWidth: 0,
      sampleStride: 1,
      frameCapacity: 1,
    });
    buffer.write(0, new Float32Array(0), new Float32Array(0), new Float32Array(0));
    expect(() =>
      buffer.write(1, new Float32Array(0), new Float32Array(0), new Float32Array(0)),
    ).toThrow();
  });

  it('rejects buffers with the wrong magic', () => {
    const wrong = new Uint8Array(16);
    expect(() => decodeReplay(wrong)).toThrow();
  });
});
