/**
 * SensorSystem: writes sensor observations into each agent's flat
 * `Float32Array` once per fixed step. Runs before the brain layer (plan 04)
 * so policies see fresh observations.
 */

import type { Vec3 } from '../types.js';
import type { IPhysicsSystem } from '../engine/physics/types.js';
import type { EngineWorld, System, SystemContext } from '../engine/world.js';
import {
  MORPHOLOGY_COMPONENT_KINDS,
  type AgentComponent,
  type JointEntry,
  type JointsComponent,
  type SegmentEntry,
  type SegmentsComponent,
  type SensorEntry,
  type SensorsComponent,
} from './components.js';
import type { JointSpec } from './types.js';

const WORLD_UP: Vec3 = { x: 0, y: 1, z: 0 };

export interface SensorSystemOptions {
  physics: IPhysicsSystem;
  /** Optional probe radius for `groundContact` overlap query. Default 0.05. */
  groundContactProbeRadius?: number;
}

export class SensorSystem implements System {
  readonly name = 'morphology:sensors';
  private readonly physics: IPhysicsSystem;
  private readonly groundProbeRadius: number;

  /** Reusable scratch direction buffer, shared across `voxelSightShort` reads. */
  private readonly _rayDir: Vec3 = { x: 0, y: 0, z: 0 };

  constructor(opts: SensorSystemOptions) {
    this.physics = opts.physics;
    this.groundProbeRadius = opts.groundContactProbeRadius ?? 0.05;
  }

  update(world: EngineWorld, _dt: number, _ctx: SystemContext): void {
    for (const entity of world.query([
      MORPHOLOGY_COMPONENT_KINDS.agent,
      MORPHOLOGY_COMPONENT_KINDS.sensors,
    ])) {
      const agent = world.getComponent<AgentComponent>(
        entity,
        MORPHOLOGY_COMPONENT_KINDS.agent,
      );
      const sensors = world.getComponent<SensorsComponent>(
        entity,
        MORPHOLOGY_COMPONENT_KINDS.sensors,
      );
      const segs = world.getComponent<SegmentsComponent>(
        entity,
        MORPHOLOGY_COMPONENT_KINDS.segments,
      );
      const joints = world.getComponent<JointsComponent>(
        entity,
        MORPHOLOGY_COMPONENT_KINDS.joints,
      );
      if (!agent || !sensors || !segs || !joints) continue;
      if (!agent.alive) continue;

      const segById = indexSegments(segs.bodies);
      const jointById = indexJoints(joints.joints);

      for (const entry of sensors.sensors) {
        this.writeSensor(entry, agent, segById, jointById);
      }

      agent.stepsSinceSpawn++;
    }
  }

  private writeSensor(
    entry: SensorEntry,
    agent: AgentComponent,
    segById: Map<string, SegmentEntry>,
    jointById: Map<string, JointEntry>,
  ): void {
    const obs = agent.observation;
    const o = entry.offset;
    const spec = entry.spec;
    switch (spec.kind) {
      case 'groundContact': {
        const seg = segById.get(spec.segmentId);
        if (!seg) {
          obs[o] = 0;
          return;
        }
        const t = this.physics.getBodyTransform(seg.bodyHandle);
        const hits = this.physics.queryOverlap(
          {
            kind: 'sphere',
            radius: this.groundProbeRadius,
            center: { x: t.position.x, y: t.position.y, z: t.position.z },
          },
        );
        let touching = 0;
        for (const h of hits) {
          if (h.bodyHandle.id === seg.bodyHandle.id) continue;
          if (h.bodyHandle.layer === 'static') {
            touching = 1;
            break;
          }
        }
        obs[o] = touching;
        return;
      }
      case 'jointAngle': {
        const j = jointById.get(spec.jointId);
        if (!j) {
          obs[o] = 0;
          return;
        }
        obs[o] = approximateJointAngle(j.jointSpec, j, this.physics, segById);
        return;
      }
      case 'jointAngularVelocity': {
        const j = jointById.get(spec.jointId);
        if (!j) {
          obs[o] = 0;
          return;
        }
        const childId = j.jointSpec.childSegmentId;
        const parentId = j.jointSpec.parentSegmentId;
        const cseg = segById.get(childId);
        const pseg = segById.get(parentId);
        if (!cseg || !pseg) {
          obs[o] = 0;
          return;
        }
        const wc = this.physics.getBodyAngularVelocity(cseg.bodyHandle);
        const wp = this.physics.getBodyAngularVelocity(pseg.bodyHandle);
        const dx = wc.x - wp.x;
        const dy = wc.y - wp.y;
        const dz = wc.z - wp.z;
        // Project onto the joint primary axis when applicable.
        const axis = primaryAxisOf(j.jointSpec);
        if (axis) {
          obs[o] = dx * axis.x + dy * axis.y + dz * axis.z;
        } else {
          obs[o] = Math.hypot(dx, dy, dz);
        }
        return;
      }
      case 'imuOrientation': {
        const seg = segById.get(spec.segmentId);
        if (!seg) {
          obs[o] = 0;
          obs[o + 1] = 0;
          obs[o + 2] = 0;
          obs[o + 3] = 1;
          return;
        }
        const t = this.physics.getBodyTransform(seg.bodyHandle);
        obs[o] = t.rotation.x;
        obs[o + 1] = t.rotation.y;
        obs[o + 2] = t.rotation.z;
        obs[o + 3] = t.rotation.w;
        return;
      }
      case 'imuAngularVelocity': {
        const seg = segById.get(spec.segmentId);
        if (!seg) {
          obs[o] = obs[o + 1] = obs[o + 2] = 0;
          return;
        }
        const w = this.physics.getBodyAngularVelocity(seg.bodyHandle);
        obs[o] = w.x;
        obs[o + 1] = w.y;
        obs[o + 2] = w.z;
        return;
      }
      case 'bodyVelocity': {
        const seg = segById.get(spec.segmentId);
        if (!seg) {
          obs[o] = obs[o + 1] = obs[o + 2] = 0;
          return;
        }
        const v = this.physics.getBodyLinearVelocity(seg.bodyHandle);
        obs[o] = v.x;
        obs[o + 1] = v.y;
        obs[o + 2] = v.z;
        return;
      }
      case 'voxelSightShort': {
        const seg = segById.get(spec.segmentId);
        if (!seg) {
          for (let i = 0; i < spec.rayCount; i++) obs[o + i] = 1;
          return;
        }
        const t = this.physics.getBodyTransform(seg.bodyHandle);
        // Forward direction = segment's local +z rotated by orientation.
        const fwd = applyQuat(t.rotation, { x: 0, y: 0, z: 1 });
        const up = applyQuat(t.rotation, { x: 0, y: 1, z: 0 });
        const right = cross(fwd, up);
        const halfFov = spec.halfFovRadians;
        const maxDist = spec.maxDistance;
        const n = spec.rayCount;
        for (let i = 0; i < n; i++) {
          const t01 = n === 1 ? 0.5 : i / (n - 1);
          const angle = (-halfFov) + t01 * (2 * halfFov);
          const c = Math.cos(angle);
          const s = Math.sin(angle);
          this._rayDir.x = fwd.x * c + right.x * s;
          this._rayDir.y = fwd.y * c + right.y * s;
          this._rayDir.z = fwd.z * c + right.z * s;
          const hit = this.physics.castRay(
            t.position,
            this._rayDir,
            maxDist,
          );
          // Filter out self-hits.
          if (hit && hit.bodyHandle.id !== seg.bodyHandle.id) {
            obs[o + i] = hit.distance / maxDist;
          } else {
            obs[o + i] = 1;
          }
        }
        return;
      }
      case 'proximityToFood': {
        const seg = segById.get(spec.segmentId);
        if (!seg) {
          obs[o] = 1;
          return;
        }
        const t = this.physics.getBodyTransform(seg.bodyHandle);
        const hits = this.physics.queryOverlap({
          kind: 'sphere',
          radius: spec.maxDistance,
          center: { ...t.position },
        });
        let best = 1;
        for (const h of hits) {
          if (h.userTag && h.userTag.includes('food')) {
            // No precise distance from queryOverlap; treat as full proximity.
            best = 0;
            break;
          }
        }
        obs[o] = best;
        return;
      }
      default: {
        const _exhaustive: never = spec;
        void _exhaustive;
      }
    }
  }
}

function indexSegments(segs: SegmentEntry[]): Map<string, SegmentEntry> {
  const m = new Map<string, SegmentEntry>();
  for (const s of segs) m.set(s.id, s);
  return m;
}

function indexJoints(js: JointEntry[]): Map<string, JointEntry> {
  const m = new Map<string, JointEntry>();
  for (const j of js) m.set(j.id, j);
  return m;
}

function primaryAxisOf(j: JointSpec): Vec3 | undefined {
  switch (j.kind) {
    case 'hinge':
      return j.axisOnParent;
    case 'slider':
      return j.axisOnParent;
    case 'swingTwist':
      return j.twistAxisOnParent;
    default:
      return undefined;
  }
}

/**
 * Approximate joint angle by reading the relative orientation of parent and
 * child bodies and projecting onto the joint axis. Good enough for sensor
 * input shaping; the trainer treats this as a continuous observation.
 */
function approximateJointAngle(
  spec: JointSpec,
  _entry: JointEntry,
  physics: IPhysicsSystem,
  segById: Map<string, SegmentEntry>,
): number {
  const childId = spec.childSegmentId;
  const parentId = spec.parentSegmentId;
  const cseg = segById.get(childId);
  const pseg = segById.get(parentId);
  if (!cseg || !pseg) return 0;
  const tc = physics.getBodyTransform(cseg.bodyHandle);
  const tp = physics.getBodyTransform(pseg.bodyHandle);
  // Relative quaternion: q_rel = q_parent^-1 * q_child
  const qPi = invQuat(tp.rotation);
  const qRel = quatMul(qPi, tc.rotation);
  const axis = primaryAxisOf(spec);
  if (!axis) {
    // Twist-free angle: rotation magnitude.
    const w = Math.max(-1, Math.min(1, qRel.w));
    return 2 * Math.acos(w);
  }
  // Project rotation onto axis: 2*atan2(dot(qRel.xyz, axis), qRel.w).
  const proj = qRel.x * axis.x + qRel.y * axis.y + qRel.z * axis.z;
  return 2 * Math.atan2(proj, qRel.w);
}

function invQuat(q: { x: number; y: number; z: number; w: number }): {
  x: number; y: number; z: number; w: number;
} {
  return { x: -q.x, y: -q.y, z: -q.z, w: q.w };
}

function quatMul(
  a: { x: number; y: number; z: number; w: number },
  b: { x: number; y: number; z: number; w: number },
): { x: number; y: number; z: number; w: number } {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

function applyQuat(q: { x: number; y: number; z: number; w: number }, v: Vec3): Vec3 {
  const tx = 2 * (q.y * v.z - q.z * v.y);
  const ty = 2 * (q.z * v.x - q.x * v.z);
  const tz = 2 * (q.x * v.y - q.y * v.x);
  return {
    x: v.x + q.w * tx + (q.y * tz - q.z * ty),
    y: v.y + q.w * ty + (q.z * tx - q.x * tz),
    z: v.z + q.w * tz + (q.x * ty - q.y * tx),
  };
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

void WORLD_UP;
