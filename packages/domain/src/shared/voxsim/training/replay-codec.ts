/**
 * Compact replay encoder/decoder. Both writer and reader live in `shared`
 * because the worker-side capture and the browser-side viewer need
 * byte-for-byte agreement and both run in JS-only contexts.
 *
 * Layout
 *
 * ```
 * +--- Header --------------------------------------------------------------+
 * | u32 magic = 0x52504c59                                                  |
 * | u32 version                                                             |
 * | u16 bodyDnaIdLen, bytes...                                              |
 * | u16 brainDnaIdLen, bytes...                                             |
 * | u16 arenaIdLen,    bytes...                                             |
 * | u8  policyKindOrdinal                                                   |
 * | u32 frameCount                                                          |
 * | u32 segmentCount                                                        |
 * | u32 actionWidth                                                         |
 * | u32 observationWidth                                                    |
 * | u32 sampleStride                                                        |
 * +--- Frames (frameCount entries) -----------------------------------------+
 * | u32 stepIndex                                                           |
 * | f32[segmentCount * 7] segment transforms (px,py,pz,qx,qy,qz,qw)         |
 * | f32[actionWidth] actions                                                |
 * | f32[observationWidth] observations                                      |
 * +-------------------------------------------------------------------------+
 * ```
 */

import type { BrainTopology } from '../brain/index.js';
import {
  REPLAY_FLOATS_PER_SEGMENT,
  REPLAY_MAGIC,
  REPLAY_VERSION,
  type ReplayFrame,
  type ReplayHeader,
  replayBytesPerFrame,
} from './replay.js';

const POLICY_KIND_ORDER: BrainTopology[] = [
  'mlp',
  'recurrentMlp',
  'neat',
  'hyperNeat',
  'neatLstm',
];

function policyKindOrdinal(kind: BrainTopology): number {
  const idx = POLICY_KIND_ORDER.indexOf(kind);
  if (idx < 0) throw new Error(`unknown brain topology '${kind}'`);
  return idx;
}

function policyKindFromOrdinal(ord: number): BrainTopology {
  const k = POLICY_KIND_ORDER[ord];
  if (!k) throw new Error(`unknown policy kind ordinal ${ord}`);
  return k;
}

interface PreparedString {
  bytes: Uint8Array;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function prepareString(value: string): PreparedString {
  const bytes = textEncoder.encode(value);
  if (bytes.length > 0xffff) {
    throw new Error(`string too long for replay header (${bytes.length} bytes)`);
  }
  return { bytes };
}

function headerByteLength(
  bodyDnaId: PreparedString,
  brainDnaId: PreparedString,
  arenaId: PreparedString,
): number {
  return (
    4 + // magic
    4 + // version
    2 + bodyDnaId.bytes.length +
    2 + brainDnaId.bytes.length +
    2 + arenaId.bytes.length +
    1 + // policyKind
    4 + // frameCount
    4 + // segmentCount
    4 + // actionWidth
    4 + // observationWidth
    4 // sampleStride
  );
}

export interface ReplayBufferOptions {
  bodyDnaId: string;
  brainDnaId: string;
  arenaId: string;
  policyKind: BrainTopology;
  segmentCount: number;
  actionWidth: number;
  observationWidth: number;
  sampleStride: number;
  frameCapacity: number;
}

/**
 * Allocation-free per-frame replay writer. Construct once per episode with a
 * known `frameCapacity`; the buffer pre-allocates and `write()` only copies
 * floats into the existing arrays.
 */
export class ReplayBuffer {
  readonly options: ReplayBufferOptions;
  private readonly buffer: Uint8Array;
  private readonly view: DataView;
  private readonly framePayloadFloatLength: number;
  private readonly frameByteLength: number;
  private readonly framesOffset: number;
  private writtenFrames = 0;

  constructor(options: ReplayBufferOptions) {
    this.options = options;
    if (options.segmentCount < 0 || options.actionWidth < 0 || options.observationWidth < 0) {
      throw new Error('replay widths must be non-negative');
    }
    if (options.frameCapacity < 0) {
      throw new Error('frameCapacity must be non-negative');
    }

    const bodyDnaId = prepareString(options.bodyDnaId);
    const brainDnaId = prepareString(options.brainDnaId);
    const arenaId = prepareString(options.arenaId);

    const headerLen = headerByteLength(bodyDnaId, brainDnaId, arenaId);
    this.framePayloadFloatLength =
      options.segmentCount * REPLAY_FLOATS_PER_SEGMENT +
      options.actionWidth +
      options.observationWidth;
    this.frameByteLength = replayBytesPerFrame(
      options.segmentCount,
      options.actionWidth,
      options.observationWidth,
    );
    const totalBytes = headerLen + this.frameByteLength * options.frameCapacity;
    this.buffer = new Uint8Array(totalBytes);
    this.view = new DataView(this.buffer.buffer);

    let offset = 0;
    this.view.setUint32(offset, REPLAY_MAGIC, true); offset += 4;
    this.view.setUint32(offset, REPLAY_VERSION, true); offset += 4;
    offset = this.writeString(offset, bodyDnaId);
    offset = this.writeString(offset, brainDnaId);
    offset = this.writeString(offset, arenaId);
    this.view.setUint8(offset, policyKindOrdinal(options.policyKind)); offset += 1;
    this.view.setUint32(offset, 0, true); // frameCount placeholder
    const frameCountOffset = offset;
    offset += 4;
    this.view.setUint32(offset, options.segmentCount, true); offset += 4;
    this.view.setUint32(offset, options.actionWidth, true); offset += 4;
    this.view.setUint32(offset, options.observationWidth, true); offset += 4;
    this.view.setUint32(offset, options.sampleStride, true); offset += 4;

    this.framesOffset = offset;
    // record placeholder offset for finalize
    this.frameCountOffset = frameCountOffset;
  }

  private readonly frameCountOffset: number;

  private writeString(offset: number, prepared: PreparedString): number {
    this.view.setUint16(offset, prepared.bytes.length, true);
    offset += 2;
    this.buffer.set(prepared.bytes, offset);
    offset += prepared.bytes.length;
    return offset;
  }

  /**
   * Append one frame. Throws if `frameCapacity` is reached. Lengths must
   * match the buffer's configuration.
   */
  write(
    stepIndex: number,
    transforms: Float32Array,
    actions: Float32Array,
    observations: Float32Array,
  ): void {
    if (this.writtenFrames >= this.options.frameCapacity) {
      throw new Error(
        `replay buffer full (capacity ${this.options.frameCapacity})`,
      );
    }
    if (transforms.length !== this.options.segmentCount * REPLAY_FLOATS_PER_SEGMENT) {
      throw new Error('transforms length mismatch');
    }
    if (actions.length !== this.options.actionWidth) {
      throw new Error('actions length mismatch');
    }
    if (observations.length !== this.options.observationWidth) {
      throw new Error('observations length mismatch');
    }
    let off = this.framesOffset + this.writtenFrames * this.frameByteLength;
    this.view.setUint32(off, stepIndex >>> 0, true); off += 4;
    for (let i = 0; i < transforms.length; i++) {
      this.view.setFloat32(off, transforms[i] ?? 0, true); off += 4;
    }
    for (let i = 0; i < actions.length; i++) {
      this.view.setFloat32(off, actions[i] ?? 0, true); off += 4;
    }
    for (let i = 0; i < observations.length; i++) {
      this.view.setFloat32(off, observations[i] ?? 0, true); off += 4;
    }
    this.writtenFrames++;
  }

  /** Number of frames written so far. */
  get frameCount(): number {
    return this.writtenFrames;
  }

  /** Float length of one frame body (excluding the stepIndex u32). */
  get frameFloatWidth(): number {
    return this.framePayloadFloatLength;
  }

  /**
   * Finalize the buffer and return a tightly-sliced `Uint8Array` containing
   * only the frames written so far.
   */
  finalize(): Uint8Array {
    this.view.setUint32(this.frameCountOffset, this.writtenFrames, true);
    const usedBytes =
      this.framesOffset + this.writtenFrames * this.frameByteLength;
    return this.buffer.subarray(0, usedBytes);
  }
}

interface DecodedReplay {
  header: ReplayHeader;
  frames: ReplayFrame[];
}

function readString(view: DataView, buffer: Uint8Array, offset: number): { value: string; offset: number } {
  const len = view.getUint16(offset, true);
  const start = offset + 2;
  const end = start + len;
  return { value: textDecoder.decode(buffer.subarray(start, end)), offset: end };
}

export function decodeReplay(buffer: Uint8Array): DecodedReplay {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let offset = 0;
  const magic = view.getUint32(offset, true); offset += 4;
  if (magic !== REPLAY_MAGIC) {
    throw new Error(`replay magic mismatch (got 0x${magic.toString(16)})`);
  }
  const version = view.getUint32(offset, true); offset += 4;
  if (version !== REPLAY_VERSION) {
    throw new Error(`replay version mismatch (got ${version}, expected ${REPLAY_VERSION})`);
  }
  const body = readString(view, buffer, offset); offset = body.offset;
  const brain = readString(view, buffer, offset); offset = brain.offset;
  const arena = readString(view, buffer, offset); offset = arena.offset;
  const policyKind = policyKindFromOrdinal(view.getUint8(offset)); offset += 1;
  const frameCount = view.getUint32(offset, true); offset += 4;
  const segmentCount = view.getUint32(offset, true); offset += 4;
  const actionWidth = view.getUint32(offset, true); offset += 4;
  const observationWidth = view.getUint32(offset, true); offset += 4;
  const sampleStride = view.getUint32(offset, true); offset += 4;

  const transformsLen = segmentCount * REPLAY_FLOATS_PER_SEGMENT;
  const frames: ReplayFrame[] = new Array(frameCount);

  for (let i = 0; i < frameCount; i++) {
    const stepIndex = view.getUint32(offset, true); offset += 4;
    const transforms = new Float32Array(transformsLen);
    for (let j = 0; j < transformsLen; j++) {
      transforms[j] = view.getFloat32(offset, true); offset += 4;
    }
    const actions = new Float32Array(actionWidth);
    for (let j = 0; j < actionWidth; j++) {
      actions[j] = view.getFloat32(offset, true); offset += 4;
    }
    const observations = new Float32Array(observationWidth);
    for (let j = 0; j < observationWidth; j++) {
      observations[j] = view.getFloat32(offset, true); offset += 4;
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

export type { DecodedReplay };
