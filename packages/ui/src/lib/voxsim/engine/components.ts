import type { Quat, Vec3 } from '../types.js';

/**
 * Component kinds reserved by plan 01. Downstream plans add their own under
 * dedicated namespaces; the open `ComponentKind = string` type permits this
 * without touching this module.
 */
export const COMPONENT_KINDS = {
  transform: 'transform',
  renderMesh: 'renderMesh',
  camera: 'camera',
  light: 'light',
} as const;

export type ComponentName = (typeof COMPONENT_KINDS)[keyof typeof COMPONENT_KINDS];

export interface TransformComponent {
  position: Vec3;
  rotation: Quat;
  /** Optional uniform scale; defaults to 1 if omitted. */
  scale?: number;
}

/** Hint for renderer-side mesh assignment. The actual Three object lives in
 *  the layered scene model (`layers.ts`), keyed by entity id. */
export interface RenderMeshComponent {
  /** Bundle id for resolving the mesh template. */
  meshId: string;
  /** Per-entity tint override. */
  tint?: number;
  /** Per-entity uniform scale override. */
  scale?: number;
  visible: boolean;
}

export type CameraKind = 'orbit' | 'follow' | 'free';

export interface CameraComponent {
  kind: CameraKind;
  /** World-space orbit target. */
  target: Vec3;
  distance: number;
  /** Radians. */
  azimuth: number;
  /** Radians. */
  elevation: number;
  fov: number;
  near: number;
  far: number;
}

export type LightKind = 'directional' | 'ambient' | 'point';

export interface LightComponent {
  kind: LightKind;
  color: number;
  intensity: number;
  position?: Vec3;
}
