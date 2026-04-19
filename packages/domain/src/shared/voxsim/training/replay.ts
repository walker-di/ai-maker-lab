/**
 * Compact replay format. The worker streams transforms, actions, and
 * observations into a single `Uint8Array` per episode without per-frame
 * allocations. Reader/writer implementations live in `packages/ui/src/lib/voxsim/training/ReplayBuffer.ts`.
 */

import type { BrainTopology } from '../brain/index.js';

export interface ReplayChunkRef {
  id: string;
  episodeId: string;
  frames: number;
  bytes: number;
}

/** Magic prefix identifying a replay payload. */
export const REPLAY_MAGIC = 0x52504c59;
export const REPLAY_VERSION = 1;

/** Floats per segment transform: position (3) + quaternion (4). */
export const REPLAY_FLOATS_PER_SEGMENT = 7;

export interface ReplayHeader {
  magic: number;
  version: number;
  bodyDnaId: string;
  brainDnaId: string;
  arenaId: string;
  policyKind: BrainTopology;
  frameCount: number;
  segmentCount: number;
  actionWidth: number;
  observationWidth: number;
  sampleStride: number;
}

export interface ReplayFrame {
  stepIndex: number;
  /** Length: `segmentCount * REPLAY_FLOATS_PER_SEGMENT`. */
  transforms: Float32Array;
  /** Length: `actionWidth`. */
  actions: Float32Array;
  /** Length: `observationWidth`. */
  observations: Float32Array;
}

/**
 * Floats per frame (excluding the 4-byte stepIndex header).
 */
export function replayFloatsPerFrame(
  segmentCount: number,
  actionWidth: number,
  observationWidth: number,
): number {
  return segmentCount * REPLAY_FLOATS_PER_SEGMENT + actionWidth + observationWidth;
}

/**
 * Bytes per frame: `4` for the stepIndex u32 plus `4 * floats`.
 */
export function replayBytesPerFrame(
  segmentCount: number,
  actionWidth: number,
  observationWidth: number,
): number {
  return 4 + 4 * replayFloatsPerFrame(segmentCount, actionWidth, observationWidth);
}
