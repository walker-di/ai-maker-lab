/**
 * MorphologyBuilder
 *
 * Walks a `BodyDna` segment tree, allocates Jolt bodies and constraints via
 * `IPhysicsSystem`, attaches Three meshes under the engine's `agents` layer,
 * and writes ECS components onto a single `Agent` entity. The result is an
 * `AgentHandle` that the trainer (plan 05), the inspector (plan 06), and the
 * persistence layer (plan 07) can consume.
 *
 * Dependencies in the inward direction only:
 *   - `IPhysicsSystem` from plan 02 (engine/physics/types.js)
 *   - `EngineWorld` from plan 01 (engine/world.js)
 *   - `SceneLayers` from plan 01 (engine/layers.js)
 *
 * No Jolt or domain imports. Three is allowed because plan 01 already pulls
 * it in as the rendering choice.
 */

import {
  BoxGeometry,
  CapsuleGeometry,
  Color,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  type BufferGeometry,
  type Material,
} from 'three';

import type { Quat, Transform, Vec3 } from '../types.js';
import type {
  BodyHandle,
  BodySpec,
  ConstraintHandle,
  ConstraintSpec,
  IPhysicsSystem,
  ShapeSpec,
} from '../engine/physics/types.js';
import type { EngineWorld, Entity } from '../engine/world.js';
import type { SceneLayers } from '../engine/layers.js';
import {
  MORPHOLOGY_COMPONENT_KINDS,
  type ActuatorEntryRuntime,
  type ActuatorsComponent,
  type AgentComponent,
  type JointEntry,
  type JointsComponent,
  type SegmentEntry,
  type SegmentsComponent,
  type SensorEntry,
  type SensorsComponent,
} from './components.js';
import {
  motorsOf,
  outputWidth,
  type ActuatorEntry,
  type BodyDna,
  type JointSpec,
  type SegmentShapeSpec,
  type SegmentSpec,
} from './types.js';

export interface AgentHandle {
  agentEntity: Entity;
  bodyDnaId: string;
  segmentBodies: Map<string, BodyHandle>;
  jointConstraints: Map<string, ConstraintHandle>;
  sensorIds: string[];
  actuatorIds: string[];
  meshIds: string[];
}

export interface MorphologyBuilderOptions {
  physics: IPhysicsSystem;
  world: EngineWorld;
  layers?: SceneLayers;
  /** Disable mesh creation (headless tests). Default: meshes are created when `layers` is provided. */
  buildMeshes?: boolean;
}

export class MorphologyBuilder {
  private readonly physics: IPhysicsSystem;
  private readonly world: EngineWorld;
  private readonly layers?: SceneLayers;
  private readonly buildMeshes: boolean;

  /** Geometry/material caches keyed by stringified shape so repeated rebuilds reuse GPU resources. */
  private readonly geomCache = new Map<string, BufferGeometry>();
  private readonly matCache = new Map<string, MeshStandardMaterial>();

  constructor(options: MorphologyBuilderOptions) {
    this.physics = options.physics;
    this.world = options.world;
    this.layers = options.layers;
    this.buildMeshes = options.buildMeshes ?? options.layers !== undefined;
  }

  build(dna: BodyDna, rootPose: Transform): AgentHandle {
    const segmentsById = new Map<string, SegmentSpec>();
    for (const seg of dna.segments) segmentsById.set(seg.id, seg);

    // Build a parent-of map from joints so we can walk segment tree.
    const parentJointOf = new Map<string, JointSpec>();
    for (const j of dna.joints) parentJointOf.set(j.childSegmentId, j);

    // 1) Compute world transform per segment by walking from the root.
    const worldTransforms = new Map<string, Transform>();
    const orderedSegmentIds = topoOrder(dna);
    for (const segId of orderedSegmentIds) {
      const seg = segmentsById.get(segId)!;
      if (segId === dna.rootSegmentId) {
        worldTransforms.set(segId, composeTransform(rootPose, seg.restPose));
      } else {
        const j = parentJointOf.get(segId);
        if (!j) {
          throw new Error(`MorphologyBuilder: non-root segment "${segId}" has no parent joint`);
        }
        const parentWorld = worldTransforms.get(j.parentSegmentId)!;
        worldTransforms.set(segId, composeTransform(parentWorld, seg.restPose));
      }
    }

    // 2) Allocate physics bodies in the same order so handle IDs are stable.
    const segmentBodies = new Map<string, BodyHandle>();
    const segmentEntries: SegmentEntry[] = [];
    const meshIds: string[] = [];
    for (const segId of orderedSegmentIds) {
      const seg = segmentsById.get(segId)!;
      const transform = worldTransforms.get(segId)!;
      const bodySpec: BodySpec = {
        kind: 'dynamic',
        layer: 'dynamic',
        shape: shapeSpecFromSegment(seg.shape),
        transform,
        mass: seg.mass,
        friction: seg.friction ?? 0.7,
        restitution: seg.restitution ?? 0.0,
        userTag: `${dna.id}:segment:${seg.id}`,
      };
      const handle = this.physics.createBody(bodySpec);
      segmentBodies.set(seg.id, handle);

      let meshId = '';
      if (this.buildMeshes && this.layers) {
        const mesh = this.makeMeshFor(seg);
        mesh.position.set(transform.position.x, transform.position.y, transform.position.z);
        mesh.quaternion.set(
          transform.rotation.x,
          transform.rotation.y,
          transform.rotation.z,
          transform.rotation.w,
        );
        mesh.name = `agent:${dna.id}:${seg.id}`;
        this.layers.agents.add(mesh);
        meshId = mesh.uuid;
        meshIds.push(meshId);
      }

      segmentEntries.push({ id: seg.id, bodyHandle: handle, meshId });
    }

    // 3) Allocate constraints, mapping body-relative pivots into world space.
    const jointConstraints = new Map<string, ConstraintHandle>();
    const jointEntries: JointEntry[] = [];
    const constraintByActuatorId = new Map<string, ConstraintHandle>();

    for (const j of dna.joints) {
      const parentBody = segmentBodies.get(j.parentSegmentId);
      const childBody = segmentBodies.get(j.childSegmentId);
      if (!parentBody || !childBody) continue;
      const parentWorld = worldTransforms.get(j.parentSegmentId)!;
      const constraintSpec = constraintFromJoint(j, parentWorld, parentBody, childBody);
      const handle = this.physics.addConstraint(constraintSpec);
      jointConstraints.set(j.id, handle);
      jointEntries.push({ id: j.id, constraintHandle: handle, jointSpec: j });
      for (const motor of motorsOf(j)) {
        constraintByActuatorId.set(motor.actuatorId, handle);
      }
    }

    // 4) Allocate observation/action buffers and sensor/actuator metadata.
    const sensorEntries: SensorEntry[] = [];
    let observationWidth = 0;
    for (const sensor of dna.sensors) {
      const w = outputWidth(sensor);
      sensorEntries.push({ spec: sensor, offset: observationWidth, width: w });
      observationWidth += w;
    }
    const observation = new Float32Array(observationWidth);

    const action = new Float32Array(dna.actuators.actuators.length);
    const actuatorEntries: ActuatorEntryRuntime[] = dna.actuators.actuators.map(
      (a: ActuatorEntry, i: number): ActuatorEntryRuntime => ({
        actuatorId: a.id,
        index: i,
        range: a.range,
        mode: a.mode,
        constraintHandle: constraintByActuatorId.get(a.id),
      }),
    );

    // 5) Materialise the agent ECS entity.
    const agentEntity = this.world.createEntity(`agent:${dna.id}`);
    const agent: AgentComponent = {
      bodyDnaId: dna.id,
      brainDnaId: undefined,
      observation,
      action,
      alive: true,
      stepsSinceSpawn: 0,
      energyUsed: 0,
    };
    this.world.addComponent(agentEntity, MORPHOLOGY_COMPONENT_KINDS.agent, agent);
    this.world.addComponent<SegmentsComponent>(
      agentEntity,
      MORPHOLOGY_COMPONENT_KINDS.segments,
      { bodies: segmentEntries },
    );
    this.world.addComponent<JointsComponent>(
      agentEntity,
      MORPHOLOGY_COMPONENT_KINDS.joints,
      { joints: jointEntries },
    );
    this.world.addComponent<SensorsComponent>(
      agentEntity,
      MORPHOLOGY_COMPONENT_KINDS.sensors,
      { sensors: sensorEntries },
    );
    this.world.addComponent<ActuatorsComponent>(
      agentEntity,
      MORPHOLOGY_COMPONENT_KINDS.actuators,
      { entries: actuatorEntries },
    );

    return {
      agentEntity,
      bodyDnaId: dna.id,
      segmentBodies,
      jointConstraints,
      sensorIds: dna.sensors.map((s) => s.id),
      actuatorIds: dna.actuators.actuators.map((a) => a.id),
      meshIds,
    };
  }

  dispose(handle: AgentHandle): void {
    for (const constraint of handle.jointConstraints.values()) {
      this.physics.removeConstraint(constraint);
    }
    for (const body of handle.segmentBodies.values()) {
      this.physics.removeBody(body);
    }
    if (this.layers) {
      for (const id of handle.meshIds) {
        const obj = this.layers.agents.getObjectByProperty('uuid', id);
        if (obj) {
          obj.removeFromParent();
          if ((obj as Mesh).geometry) (obj as Mesh).geometry.dispose();
          // Materials are cached; do not dispose per-instance.
        }
      }
    }
    this.world.removeComponent(handle.agentEntity, MORPHOLOGY_COMPONENT_KINDS.actuators);
    this.world.removeComponent(handle.agentEntity, MORPHOLOGY_COMPONENT_KINDS.sensors);
    this.world.removeComponent(handle.agentEntity, MORPHOLOGY_COMPONENT_KINDS.joints);
    this.world.removeComponent(handle.agentEntity, MORPHOLOGY_COMPONENT_KINDS.segments);
    this.world.removeComponent(handle.agentEntity, MORPHOLOGY_COMPONENT_KINDS.agent);
    this.world.removeEntity(handle.agentEntity);
  }

  /** Free cached geometry/material resources. Call on full engine teardown. */
  disposeCaches(): void {
    for (const g of this.geomCache.values()) g.dispose();
    for (const m of this.matCache.values()) (m as Material).dispose();
    this.geomCache.clear();
    this.matCache.clear();
  }

  private makeMeshFor(seg: SegmentSpec): Mesh {
    const geomKey = shapeKey(seg.shape);
    let geom = this.geomCache.get(geomKey);
    if (!geom) {
      geom = makeGeometry(seg.shape);
      this.geomCache.set(geomKey, geom);
    }
    const matKey = seg.colorHint ?? '#a8b3c7';
    let mat = this.matCache.get(matKey);
    if (!mat) {
      mat = new MeshStandardMaterial({ color: new Color(matKey) });
      this.matCache.set(matKey, mat);
    }
    return new Mesh(geom, mat);
  }
}

function shapeKey(shape: SegmentShapeSpec): string {
  switch (shape.kind) {
    case 'box':
      return `box:${shape.halfExtents.x}:${shape.halfExtents.y}:${shape.halfExtents.z}`;
    case 'sphere':
      return `sphere:${shape.radius}`;
    case 'capsule':
      return `capsule:${shape.halfHeight}:${shape.radius}`;
  }
}

function makeGeometry(shape: SegmentShapeSpec): BufferGeometry {
  switch (shape.kind) {
    case 'box':
      return new BoxGeometry(
        shape.halfExtents.x * 2,
        shape.halfExtents.y * 2,
        shape.halfExtents.z * 2,
      );
    case 'sphere':
      return new SphereGeometry(shape.radius, 16, 12);
    case 'capsule':
      return new CapsuleGeometry(shape.radius, shape.halfHeight * 2, 8, 16);
  }
}

function shapeSpecFromSegment(shape: SegmentShapeSpec): ShapeSpec {
  switch (shape.kind) {
    case 'box':
      return { kind: 'box', halfExtents: { ...shape.halfExtents } };
    case 'sphere':
      return { kind: 'sphere', radius: shape.radius };
    case 'capsule':
      return { kind: 'capsule', halfHeight: shape.halfHeight, radius: shape.radius };
  }
}

/** Compose two transforms: out = parent * local. */
export function composeTransform(parent: Transform, local: Transform): Transform {
  const rot = quatMul(parent.rotation, local.rotation);
  const rotated = applyQuat(parent.rotation, local.position);
  return {
    position: {
      x: parent.position.x + rotated.x,
      y: parent.position.y + rotated.y,
      z: parent.position.z + rotated.z,
    },
    rotation: rot,
  };
}

function quatMul(a: Quat, b: Quat): Quat {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

function applyQuat(q: Quat, v: Vec3): Vec3 {
  const tx = 2 * (q.y * v.z - q.z * v.y);
  const ty = 2 * (q.z * v.x - q.x * v.z);
  const tz = 2 * (q.x * v.y - q.y * v.x);
  return {
    x: v.x + q.w * tx + (q.y * tz - q.z * ty),
    y: v.y + q.w * ty + (q.z * tx - q.x * tz),
    z: v.z + q.w * tz + (q.x * ty - q.y * tx),
  };
}

/** Walk the segment tree from root, returning ids in BFS order (root first). */
function topoOrder(dna: BodyDna): string[] {
  const childrenOf = new Map<string, string[]>();
  for (const j of dna.joints) {
    const arr = childrenOf.get(j.parentSegmentId) ?? [];
    arr.push(j.childSegmentId);
    childrenOf.set(j.parentSegmentId, arr);
  }
  const order: string[] = [];
  const stack: string[] = [dna.rootSegmentId];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const cur = stack.shift()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    order.push(cur);
    for (const c of childrenOf.get(cur) ?? []) stack.push(c);
  }
  // Append unreachable segments at the end (validation should normally catch
  // these). Caller will only see them if validation is skipped.
  for (const seg of dna.segments) {
    if (!seen.has(seg.id)) order.push(seg.id);
  }
  return order;
}

/** Translate a body-relative `JointSpec` into an engine-frame `ConstraintSpec`. */
function constraintFromJoint(
  joint: JointSpec,
  parentWorld: Transform,
  bodyA: BodyHandle,
  bodyB: BodyHandle,
): ConstraintSpec {
  const toWorld = (vLocal: Vec3) => {
    const r = applyQuat(parentWorld.rotation, vLocal);
    return {
      x: parentWorld.position.x + r.x,
      y: parentWorld.position.y + r.y,
      z: parentWorld.position.z + r.z,
    };
  };
  const rotateOnly = (vLocal: Vec3) => applyQuat(parentWorld.rotation, vLocal);

  switch (joint.kind) {
    case 'fixed':
      return {
        kind: 'fixed',
        bodyA,
        bodyB,
        transformA: composeTransform(parentWorld, joint.transformOnParent),
        transformB: composeTransform(parentWorld, joint.transformOnChild),
      };
    case 'hinge':
      return {
        kind: 'hinge',
        bodyA,
        bodyB,
        pivot: toWorld(joint.pivotOnParent),
        axis: rotateOnly(joint.axisOnParent),
        minAngle: joint.minAngle,
        maxAngle: joint.maxAngle,
        motor: joint.motor
          ? {
              mode: joint.motor.mode,
              maxForce: joint.motor.maxForce,
              springFrequency: joint.motor.springFrequency,
              springDamping: joint.motor.springDamping,
            }
          : undefined,
      };
    case 'slider':
      return {
        kind: 'slider',
        bodyA,
        bodyB,
        pivot: toWorld(joint.pivotOnParent),
        axis: rotateOnly(joint.axisOnParent),
        minDistance: joint.minDistance,
        maxDistance: joint.maxDistance,
        motor: joint.motor
          ? {
              mode: joint.motor.mode,
              maxForce: joint.motor.maxForce,
            }
          : undefined,
      };
    case 'swingTwist':
      return {
        kind: 'swingTwist',
        bodyA,
        bodyB,
        position: toWorld(joint.positionOnParent),
        twistAxis: rotateOnly(joint.twistAxisOnParent),
        planeAxis: rotateOnly(joint.planeAxisOnParent),
        normalHalfConeAngle: joint.normalHalfConeAngle,
        planeHalfConeAngle: joint.planeHalfConeAngle,
        twistMinAngle: joint.twistMinAngle,
        twistMaxAngle: joint.twistMaxAngle,
      };
    case 'sixDof':
      return {
        kind: 'sixDof',
        bodyA,
        bodyB,
        position: toWorld(joint.positionOnParent),
        axisX: rotateOnly(joint.axisXOnParent),
        axisY: rotateOnly(joint.axisYOnParent),
        translationLimits: { ...joint.translationLimits },
        rotationLimits: { ...joint.rotationLimits },
      };
    default: {
      const _exhaustive: never = joint;
      void _exhaustive;
      throw new Error('Unknown joint kind');
    }
  }
}

