/**
 * Headless replay playback model. Decodes a binary replay (format from
 * `05-training-evolution-and-workers.md`) and exposes a cursor plus
 * `nextFrame` / `seek` operations. The Svelte panel binds this to a
 * `VoxsimEngine` running in `preview` mode.
 *
 * Replay playback never advances physics. The panel applies the recorded
 * `Transform`s directly to segment meshes.
 */

import { ReplayBufferReader, type ReplayHeader } from '../training/replay-reader.js';
import type { BrainTopology } from '../brain/types.js';
import type {
  InspectorActivationFrame,
  InspectorReplayCursor,
  MlpActivationFrame,
  NeatActivationFrame,
} from './types.js';
import { clampFrameIndex } from './types.js';

export interface ReplayFrameSnapshot {
  stepIndex: number;
  /** Per-segment transform floats (`px,py,pz,qx,qy,qz,qw` per segment). */
  transforms: Float32Array;
  /** Decoded actions sampled at this frame. */
  actions: Float32Array;
  /** Recorded observations sampled at this frame. */
  observations: Float32Array;
  /** Tap-equivalent activation frame derived from the recorded inputs/outputs. */
  activationFrame: InspectorActivationFrame;
}

export interface ReplayPlayerOptions {
  replayRefId: string;
  bytes: Uint8Array;
  /** When the brain was an MLP, the layer widths (per dense layer) so we
   * can synthesize hidden activations as zero-filled placeholders. */
  mlpHiddenWidths?: number[];
}

export class ReplayPlayer {
  readonly reader: ReplayBufferReader;
  readonly header: ReplayHeader;
  private cursor: InspectorReplayCursor;
  private readonly mlpHiddenWidths: number[];
  private readonly transforms: Float32Array;
  private readonly actions: Float32Array;
  private readonly observations: Float32Array;

  constructor(options: ReplayPlayerOptions) {
    this.reader = new ReplayBufferReader(options.bytes);
    this.header = this.reader.header;
    this.mlpHiddenWidths = options.mlpHiddenWidths ?? [];
    const buffers = this.reader.allocateFrameBuffers();
    this.transforms = buffers.transforms;
    this.actions = buffers.actions;
    this.observations = buffers.observations;
    this.cursor = {
      replayRefId: options.replayRefId,
      frameIndex: 0,
      frameCount: this.header.frameCount,
      playing: false,
      playbackRate: 1,
      policyKind: this.header.policyKind as BrainTopology,
    };
  }

  get currentCursor(): InspectorReplayCursor {
    return { ...this.cursor };
  }

  setPlaybackRate(rate: number): void {
    this.cursor = { ...this.cursor, playbackRate: rate };
  }

  play(): void {
    this.cursor = { ...this.cursor, playing: true };
  }

  pause(): void {
    this.cursor = { ...this.cursor, playing: false };
  }

  seek(frameIndex: number): ReplayFrameSnapshot {
    const next = clampFrameIndex(frameIndex, this.header.frameCount);
    this.cursor = { ...this.cursor, frameIndex: next };
    return this.readCurrent();
  }

  /** Advance one frame respecting `playbackRate` (`elapsedSeconds * rate * sampleRate`). */
  advance(elapsedSeconds: number, sampleRateHz = 60): ReplayFrameSnapshot {
    if (!this.cursor.playing) return this.readCurrent();
    const advanceFrames = Math.max(
      0,
      Math.floor(elapsedSeconds * this.cursor.playbackRate * sampleRateHz),
    );
    const next = clampFrameIndex(
      this.cursor.frameIndex + advanceFrames,
      this.header.frameCount,
    );
    if (next === this.header.frameCount - 1) {
      this.cursor = { ...this.cursor, frameIndex: next, playing: false };
    } else {
      this.cursor = { ...this.cursor, frameIndex: next };
    }
    return this.readCurrent();
  }

  private readCurrent(): ReplayFrameSnapshot {
    const stepIndex = this.reader.readFrameInto(
      this.cursor.frameIndex,
      this.transforms,
      this.actions,
      this.observations,
    );
    return {
      stepIndex,
      transforms: this.transforms,
      actions: this.actions,
      observations: this.observations,
      activationFrame: this.synthesizeActivationFrame(stepIndex),
    };
  }

  private synthesizeActivationFrame(stepIndex: number): InspectorActivationFrame {
    if (this.header.policyKind === 'mlp' || this.header.policyKind === 'recurrentMlp') {
      const hidden: Float32Array[] = this.mlpHiddenWidths.map(
        (w) => new Float32Array(w),
      );
      const frame: MlpActivationFrame = {
        kind: 'mlp',
        stepIndex,
        inputs: this.observations,
        hidden,
        outputsRaw: this.actions,
        outputsDecoded: this.actions,
      };
      return frame;
    }
    const frame: NeatActivationFrame = {
      kind: this.header.policyKind as 'neat' | 'hyperNeat' | 'neatLstm',
      stepIndex,
      inputs: this.observations,
      nodeActivations: new Map(),
      outputsRaw: this.actions,
      outputsDecoded: this.actions,
    };
    return frame;
  }
}
