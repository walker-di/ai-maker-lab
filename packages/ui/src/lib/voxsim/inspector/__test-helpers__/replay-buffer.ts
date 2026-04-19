import {
  REPLAY_FLOATS_PER_SEGMENT,
  REPLAY_MAGIC,
  REPLAY_VERSION,
  type ReplayPolicyKind,
} from '../../training/replay-reader.js';

const POLICY_ORDINAL: Record<ReplayPolicyKind, number> = {
  mlp: 0,
  recurrentMlp: 1,
  neat: 2,
  hyperNeat: 3,
  neatLstm: 4,
};

export interface BuildReplayOptions {
  policyKind?: ReplayPolicyKind;
  frameCount?: number;
  segmentCount?: number;
  actionWidth?: number;
  observationWidth?: number;
  sampleStride?: number;
  bodyDnaId?: string;
  brainDnaId?: string;
  arenaId?: string;
}

/**
 * Hand-build a replay buffer matching the canonical layout. Mirrors the
 * domain encoder; UI tests cannot import from the domain package.
 */
export function buildReplayBuffer(options: BuildReplayOptions = {}): Uint8Array {
  const policyKind = options.policyKind ?? 'mlp';
  const frameCount = options.frameCount ?? 4;
  const segmentCount = options.segmentCount ?? 2;
  const actionWidth = options.actionWidth ?? 2;
  const observationWidth = options.observationWidth ?? 3;
  const sampleStride = options.sampleStride ?? 1;
  const bodyDnaId = options.bodyDnaId ?? 'body';
  const brainDnaId = options.brainDnaId ?? 'brain';
  const arenaId = options.arenaId ?? 'arena';

  const enc = new TextEncoder();
  const bodyBytes = enc.encode(bodyDnaId);
  const brainBytes = enc.encode(brainDnaId);
  const arenaBytes = enc.encode(arenaId);

  const headerLen =
    4 + 4 +
    2 + bodyBytes.length +
    2 + brainBytes.length +
    2 + arenaBytes.length +
    1 + 4 + 4 + 4 + 4 + 4;

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
  view.setUint8(off, POLICY_ORDINAL[policyKind]); off += 1;
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
