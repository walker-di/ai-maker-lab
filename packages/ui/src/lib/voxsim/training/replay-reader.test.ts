import { describe, expect, it } from 'bun:test';

import {
  ReplayBufferReader,
  decodeReplay,
  REPLAY_FLOATS_PER_SEGMENT,
  REPLAY_MAGIC,
  REPLAY_VERSION,
} from './replay-reader.js';

/**
 * Hand-build a binary replay buffer matching the domain encoder layout.
 * `packages/ui` does not depend on `packages/domain`, so we deliberately
 * encode here rather than importing the encoder.
 */
function buildReplay(): Uint8Array {
  const bodyId = 'body-1';
  const brainId = 'brain-1';
  const arenaId = 'arena-1';
  const policyOrdinal = 0; // 'mlp'
  const segmentCount = 2;
  const actionWidth = 3;
  const observationWidth = 4;
  const sampleStride = 2;
  const frameCount = 3;

  const enc = new TextEncoder();
  const bodyBytes = enc.encode(bodyId);
  const brainBytes = enc.encode(brainId);
  const arenaBytes = enc.encode(arenaId);

  const headerLen =
    4 + // magic
    4 + // version
    2 + bodyBytes.length +
    2 + brainBytes.length +
    2 + arenaBytes.length +
    1 + // policyKind
    4 + // frameCount
    4 + // segmentCount
    4 + // actionWidth
    4 + // observationWidth
    4; // sampleStride

  const transformsLen = segmentCount * REPLAY_FLOATS_PER_SEGMENT;
  const frameBytes = 4 + (transformsLen + actionWidth + observationWidth) * 4;
  const buffer = new Uint8Array(headerLen + frameCount * frameBytes);
  const view = new DataView(buffer.buffer);
  let off = 0;
  view.setUint32(off, REPLAY_MAGIC, true); off += 4;
  view.setUint32(off, REPLAY_VERSION, true); off += 4;
  function writeStr(bytes: Uint8Array): void {
    view.setUint16(off, bytes.length, true);
    off += 2;
    buffer.set(bytes, off);
    off += bytes.length;
  }
  writeStr(bodyBytes);
  writeStr(brainBytes);
  writeStr(arenaBytes);
  view.setUint8(off, policyOrdinal); off += 1;
  view.setUint32(off, frameCount, true); off += 4;
  view.setUint32(off, segmentCount, true); off += 4;
  view.setUint32(off, actionWidth, true); off += 4;
  view.setUint32(off, observationWidth, true); off += 4;
  view.setUint32(off, sampleStride, true); off += 4;

  for (let f = 0; f < frameCount; f++) {
    view.setUint32(off, f * sampleStride, true); off += 4;
    for (let i = 0; i < transformsLen; i++) {
      view.setFloat32(off, f * 100 + i, true); off += 4;
    }
    for (let i = 0; i < actionWidth; i++) {
      view.setFloat32(off, f * 10 + i, true); off += 4;
    }
    for (let i = 0; i < observationWidth; i++) {
      view.setFloat32(off, f + i * 0.5, true); off += 4;
    }
  }
  return buffer;
}

describe('UI replay reader', () => {
  it('decodeReplay parses header and frames from the canonical byte layout', () => {
    const bytes = buildReplay();
    const decoded = decodeReplay(bytes);
    expect(decoded.header.bodyDnaId).toBe('body-1');
    expect(decoded.header.brainDnaId).toBe('brain-1');
    expect(decoded.header.arenaId).toBe('arena-1');
    expect(decoded.header.policyKind).toBe('mlp');
    expect(decoded.header.frameCount).toBe(3);
    expect(decoded.header.segmentCount).toBe(2);
    expect(decoded.header.actionWidth).toBe(3);
    expect(decoded.header.observationWidth).toBe(4);
    expect(decoded.header.sampleStride).toBe(2);
    expect(decoded.frames).toHaveLength(3);
    expect(decoded.frames[0]?.stepIndex).toBe(0);
    expect(decoded.frames[1]?.stepIndex).toBe(2);
    expect(decoded.frames[2]?.stepIndex).toBe(4);
    expect(decoded.frames[2]?.transforms[0]).toBe(200);
    expect(decoded.frames[1]?.actions[2]).toBe(12);
    expect(decoded.frames[0]?.observations[3]).toBeCloseTo(1.5);
  });

  it('ReplayBufferReader reads frames lazily into preallocated buffers', () => {
    const bytes = buildReplay();
    const reader = new ReplayBufferReader(bytes);
    expect(reader.header.frameCount).toBe(3);
    const { transforms, actions, observations } = reader.allocateFrameBuffers();
    const stepIndex = reader.readFrameInto(2, transforms, actions, observations);
    expect(stepIndex).toBe(4);
    expect(transforms[0]).toBe(200);
    expect(actions[1]).toBe(21);
    expect(observations[2]).toBeCloseTo(3);
  });

  it('ReplayBufferReader rejects out-of-range frames and width mismatches', () => {
    const reader = new ReplayBufferReader(buildReplay());
    const { transforms, actions, observations } = reader.allocateFrameBuffers();
    expect(() => reader.readFrameInto(99, transforms, actions, observations)).toThrow(
      /out of range/,
    );
    expect(() =>
      reader.readFrameInto(0, new Float32Array(1), actions, observations),
    ).toThrow(/transforms length mismatch/);
  });

  it('decodeReplay rejects bad magic and version', () => {
    const bytes = buildReplay();
    const broken = new Uint8Array(bytes);
    new DataView(broken.buffer).setUint32(0, 0xdeadbeef, true);
    expect(() => decodeReplay(broken)).toThrow(/magic mismatch/);

    const wrongVersion = new Uint8Array(buildReplay());
    new DataView(wrongVersion.buffer).setUint32(4, 9999, true);
    expect(() => decodeReplay(wrongVersion)).toThrow(/version mismatch/);
  });
});
