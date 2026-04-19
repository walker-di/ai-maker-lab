/**
 * No-op physics system for headless tests, replay viewers, and any
 * environment that does not need rigid-body simulation.
 *
 * It still tracks bodies so downstream code (sensors, snapshots) sees
 * stable handles, but `step()` does not move anything. This is the path
 * the engine falls back to when no `IPhysicsSystem` is registered.
 */

import type { ArenaDefinition, Transform, Vec3 } from '../../types.js';
import {
  cloneTransform,
  type BodyHandle,
  type BodySpec,
  type ConstraintHandle,
  type ConstraintSpec,
  type IPhysicsSystem,
  type MotorTarget,
  type OverlapHit,
  type PhysicsConfig,
  type PhysicsLayerFilter,
  type PhysicsSnapshot,
  type RayHit,
  type ShapeQuery,
} from './types.js';

interface Entry {
  handle: BodyHandle;
  transform: Transform;
}

export class NullPhysicsSystem implements IPhysicsSystem {
  private readonly bodies = new Map<number, Entry>();
  private readonly constraints = new Map<number, ConstraintHandle>();
  private nextBodyId = 1;
  private nextConstraintId = 1;
  private stepIndex = 0;

  async init(_config: PhysicsConfig): Promise<void> {
    /* no-op */
  }

  loadArenaColliders(_arena: ArenaDefinition): void {
    /* no-op */
  }

  unloadArenaColliders(): void {
    /* no-op */
  }

  step(_dtMs: number): void {
    this.stepIndex++;
  }

  snapshot(): PhysicsSnapshot {
    return {
      bodies: Array.from(this.bodies.values()).map((e) => ({
        handle: e.handle,
        previous: cloneTransform(e.transform),
        latest: cloneTransform(e.transform),
      })),
      stepIndex: this.stepIndex,
    };
  }

  dispose(): void {
    this.bodies.clear();
    this.constraints.clear();
    this.nextBodyId = 1;
    this.nextConstraintId = 1;
    this.stepIndex = 0;
  }

  createBody(spec: BodySpec): BodyHandle {
    const id = this.nextBodyId++;
    const handle: BodyHandle = {
      id,
      layer: spec.layer ?? (spec.kind === 'static' ? 'static' : 'dynamic'),
      userTag: spec.userTag,
    };
    this.bodies.set(id, { handle, transform: cloneTransform(spec.transform) });
    return handle;
  }

  removeBody(handle: BodyHandle): void {
    this.bodies.delete(handle.id);
  }

  addConstraint(spec: ConstraintSpec): ConstraintHandle {
    const id = this.nextConstraintId++;
    const handle: ConstraintHandle = {
      id, kind: spec.kind, bodyA: spec.bodyA, bodyB: spec.bodyB,
    };
    this.constraints.set(id, handle);
    return handle;
  }

  removeConstraint(handle: ConstraintHandle): void {
    this.constraints.delete(handle.id);
  }

  setMotorTarget(_handle: ConstraintHandle, _target: MotorTarget): void {
    /* no-op */
  }

  getBodyTransform(handle: BodyHandle): Transform {
    const entry = this.bodies.get(handle.id);
    if (!entry) throw new Error(`NullPhysicsSystem: unknown body handle ${handle.id}`);
    return cloneTransform(entry.transform);
  }

  setBodyTransform(handle: BodyHandle, transform: Transform): void {
    const entry = this.bodies.get(handle.id);
    if (!entry) return;
    entry.transform = cloneTransform(transform);
  }

  applyImpulse(_handle: BodyHandle, _impulse: Vec3, _at?: Vec3): void {
    /* no-op */
  }

  getBodyLinearVelocity(_handle: BodyHandle): Vec3 {
    return { x: 0, y: 0, z: 0 };
  }

  getBodyAngularVelocity(_handle: BodyHandle): Vec3 {
    return { x: 0, y: 0, z: 0 };
  }

  castRay(
    _origin: Vec3,
    _direction: Vec3,
    _maxDistance: number,
    _filter?: PhysicsLayerFilter,
  ): RayHit | undefined {
    return undefined;
  }

  queryOverlap(_query: ShapeQuery, _filter?: PhysicsLayerFilter): OverlapHit[] {
    return [];
  }
}
