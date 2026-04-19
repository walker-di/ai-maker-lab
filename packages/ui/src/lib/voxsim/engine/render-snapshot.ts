import type { Quat, Vec3 } from '../types.js';

/**
 * Snapshot of interpolated transforms produced by the engine each render
 * frame. Inspectors and replay viewers consume this without touching Three
 * scene state directly.
 */
export interface RenderSnapshotEntity {
  entity: number;
  tag?: string;
  meshId?: string;
  position: Vec3;
  rotation: Quat;
  visible: boolean;
}

export interface RenderSnapshot {
  /** Interpolation alpha between the last two fixed steps, in [0, 1). */
  alpha: number;
  /** Total fixed steps the simulation has executed. */
  stepIndex: number;
  /** Real-world time at snapshot capture, in milliseconds. */
  capturedAtMs: number;
  cameraPosition: Vec3;
  cameraTarget: Vec3;
  entities: RenderSnapshotEntity[];
}

export function emptyRenderSnapshot(): RenderSnapshot {
  return {
    alpha: 0,
    stepIndex: 0,
    capturedAtMs: 0,
    cameraPosition: { x: 0, y: 0, z: 0 },
    cameraTarget: { x: 0, y: 0, z: 0 },
    entities: [],
  };
}
