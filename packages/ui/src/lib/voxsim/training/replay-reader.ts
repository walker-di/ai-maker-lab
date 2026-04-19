/**
 * Browser-side replay reader. Mirrors the binary layout produced by
 * `packages/domain/src/shared/voxsim/training/replay-codec.ts`. The two files
 * MUST stay byte-for-byte compatible.
 *
 * The UI package does not depend on `packages/domain`, so the format is
 * duplicated here intentionally. If the encoder layout or version changes,
 * update both files in the same change.
 */

export const REPLAY_MAGIC = 0x52504c59;
export const REPLAY_VERSION = 1;
export const REPLAY_FLOATS_PER_SEGMENT = 7;

export type ReplayPolicyKind =
  | 'mlp'
  | 'recurrentMlp'
  | 'neat'
  | 'hyperNeat'
  | 'neatLstm';

const POLICY_KIND_ORDER: ReplayPolicyKind[] = [
  'mlp',
  'recurrentMlp',
  'neat',
  'hyperNeat',
  'neatLstm',
];

export interface ReplayHeader {
  magic: number;
  version: number;
  bodyDnaId: string;
  brainDnaId: string;
  arenaId: string;
  policyKind: ReplayPolicyKind;
  frameCount: number;
  segmentCount: number;
  actionWidth: number;
  observationWidth: number;
  sampleStride: number;
}

export interface ReplayFrame {
  stepIndex: number;
  transforms: Float32Array;
  actions: Float32Array;
  observations: Float32Array;
}

export interface DecodedReplay {
  header: ReplayHeader;
  frames: ReplayFrame[];
}

const textDecoder = new TextDecoder();

function readString(
  view: DataView,
  buffer: Uint8Array,
  offset: number,
): { value: string; offset: number } {
  const len = view.getUint16(offset, true);
  const start = offset + 2;
  const end = start + len;
  return {
    value: textDecoder.decode(buffer.subarray(start, end)),
    offset: end,
  };
}

function policyKindFromOrdinal(ord: number): ReplayPolicyKind {
  const k = POLICY_KIND_ORDER[ord];
  if (!k) throw new Error(`unknown policy kind ordinal ${ord}`);
  return k;
}

/** Decode a complete replay buffer into header and frames. */
export function decodeReplay(buffer: Uint8Array): DecodedReplay {
  const view = new DataView(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength,
  );
  let offset = 0;
  const magic = view.getUint32(offset, true);
  offset += 4;
  if (magic !== REPLAY_MAGIC) {
    throw new Error(`replay magic mismatch (got 0x${magic.toString(16)})`);
  }
  const version = view.getUint32(offset, true);
  offset += 4;
  if (version !== REPLAY_VERSION) {
    throw new Error(
      `replay version mismatch (got ${version}, expected ${REPLAY_VERSION})`,
    );
  }
  const body = readString(view, buffer, offset);
  offset = body.offset;
  const brain = readString(view, buffer, offset);
  offset = brain.offset;
  const arena = readString(view, buffer, offset);
  offset = arena.offset;
  const policyKind = policyKindFromOrdinal(view.getUint8(offset));
  offset += 1;
  const frameCount = view.getUint32(offset, true);
  offset += 4;
  const segmentCount = view.getUint32(offset, true);
  offset += 4;
  const actionWidth = view.getUint32(offset, true);
  offset += 4;
  const observationWidth = view.getUint32(offset, true);
  offset += 4;
  const sampleStride = view.getUint32(offset, true);
  offset += 4;

  const transformsLen = segmentCount * REPLAY_FLOATS_PER_SEGMENT;
  const frames: ReplayFrame[] = new Array(frameCount);

  for (let i = 0; i < frameCount; i++) {
    const stepIndex = view.getUint32(offset, true);
    offset += 4;
    const transforms = new Float32Array(transformsLen);
    for (let j = 0; j < transformsLen; j++) {
      transforms[j] = view.getFloat32(offset, true);
      offset += 4;
    }
    const actions = new Float32Array(actionWidth);
    for (let j = 0; j < actionWidth; j++) {
      actions[j] = view.getFloat32(offset, true);
      offset += 4;
    }
    const observations = new Float32Array(observationWidth);
    for (let j = 0; j < observationWidth; j++) {
      observations[j] = view.getFloat32(offset, true);
      offset += 4;
    }
    frames[i] = { stepIndex, transforms, actions, observations };
  }

  const header: ReplayHeader = {
    magic,
    version,
    bodyDnaId: body.value,
    brainDnaId: brain.value,
    arenaId: arena.value,
    policyKind,
    frameCount,
    segmentCount,
    actionWidth,
    observationWidth,
    sampleStride,
  };
  return { header, frames };
}

/**
 * Lazy frame iterator that decodes one frame at a time without materializing
 * all frames in memory. Useful for the replay scrubber, which only needs the
 * current frame.
 */
export class ReplayBufferReader {
  readonly header: ReplayHeader;
  private readonly view: DataView;
  private readonly buffer: Uint8Array;
  private readonly framesOffset: number;
  private readonly frameByteLength: number;
  private readonly transformsLen: number;

  constructor(buffer: Uint8Array) {
    this.buffer = buffer;
    this.view = new DataView(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength,
    );
    let offset = 0;
    const magic = this.view.getUint32(offset, true);
    offset += 4;
    if (magic !== REPLAY_MAGIC) {
      throw new Error(`replay magic mismatch (got 0x${magic.toString(16)})`);
    }
    const version = this.view.getUint32(offset, true);
    offset += 4;
    if (version !== REPLAY_VERSION) {
      throw new Error(
        `replay version mismatch (got ${version}, expected ${REPLAY_VERSION})`,
      );
    }
    const body = readString(this.view, buffer, offset);
    offset = body.offset;
    const brain = readString(this.view, buffer, offset);
    offset = brain.offset;
    const arena = readString(this.view, buffer, offset);
    offset = arena.offset;
    const policyKind = policyKindFromOrdinal(this.view.getUint8(offset));
    offset += 1;
    const frameCount = this.view.getUint32(offset, true);
    offset += 4;
    const segmentCount = this.view.getUint32(offset, true);
    offset += 4;
    const actionWidth = this.view.getUint32(offset, true);
    offset += 4;
    const observationWidth = this.view.getUint32(offset, true);
    offset += 4;
    const sampleStride = this.view.getUint32(offset, true);
    offset += 4;

    this.header = {
      magic,
      version,
      bodyDnaId: body.value,
      brainDnaId: brain.value,
      arenaId: arena.value,
      policyKind,
      frameCount,
      segmentCount,
      actionWidth,
      observationWidth,
      sampleStride,
    };
    this.framesOffset = offset;
    this.transformsLen = segmentCount * REPLAY_FLOATS_PER_SEGMENT;
    this.frameByteLength =
      4 +
      (this.transformsLen + actionWidth + observationWidth) * 4;
  }

  /**
   * Read frame `index` into the provided destination arrays without
   * allocating new typed arrays. The destination arrays must match the
   * widths described by the header.
   */
  readFrameInto(
    index: number,
    transforms: Float32Array,
    actions: Float32Array,
    observations: Float32Array,
  ): number {
    if (index < 0 || index >= this.header.frameCount) {
      throw new RangeError(
        `frame ${index} out of range (frameCount=${this.header.frameCount})`,
      );
    }
    if (transforms.length !== this.transformsLen) {
      throw new Error('transforms length mismatch');
    }
    if (actions.length !== this.header.actionWidth) {
      throw new Error('actions length mismatch');
    }
    if (observations.length !== this.header.observationWidth) {
      throw new Error('observations length mismatch');
    }
    let off = this.framesOffset + index * this.frameByteLength;
    const stepIndex = this.view.getUint32(off, true);
    off += 4;
    for (let i = 0; i < this.transformsLen; i++) {
      transforms[i] = this.view.getFloat32(off, true);
      off += 4;
    }
    for (let i = 0; i < this.header.actionWidth; i++) {
      actions[i] = this.view.getFloat32(off, true);
      off += 4;
    }
    for (let i = 0; i < this.header.observationWidth; i++) {
      observations[i] = this.view.getFloat32(off, true);
      off += 4;
    }
    return stepIndex;
  }

  /** Allocate matching destination buffers sized to this replay's widths. */
  allocateFrameBuffers(): {
    transforms: Float32Array;
    actions: Float32Array;
    observations: Float32Array;
  } {
    return {
      transforms: new Float32Array(this.transformsLen),
      actions: new Float32Array(this.header.actionWidth),
      observations: new Float32Array(this.header.observationWidth),
    };
  }
}
