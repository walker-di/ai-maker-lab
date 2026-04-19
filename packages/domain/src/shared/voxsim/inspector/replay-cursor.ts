/**
 * Cursor state for the replay viewer. The orchestrator mounts NEAT-specific
 * panels based on `policyKind`, mirrored from the replay binary header.
 */

import type { BrainTopology } from '../brain/index.js';

export interface InspectorReplayCursor {
  replayRefId: string;
  frameIndex: number;
  frameCount: number;
  playing: boolean;
  playbackRate: number;
  policyKind: BrainTopology;
}

export function clampFrameIndex(
  desired: number,
  frameCount: number,
): number {
  if (frameCount <= 0) return 0;
  if (desired < 0) return 0;
  if (desired >= frameCount) return frameCount - 1;
  return Math.floor(desired);
}
