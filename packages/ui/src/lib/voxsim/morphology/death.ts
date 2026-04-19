/**
 * Death rule evaluation. The trainer (plan 05) decides what to do when an
 * agent dies (respawn, end episode, etc.); this module just decides when the
 * rule fires.
 */

import type { Vec3 } from '../types.js';
import type { IPhysicsSystem } from '../engine/physics/types.js';
import type { EngineWorld } from '../engine/world.js';
import {
  MORPHOLOGY_COMPONENT_KINDS,
  type AgentComponent,
  type SegmentEntry,
  type SegmentsComponent,
} from './components.js';
import type { DeathRule } from './types.js';

export interface DeathEvaluatorOptions {
  physics: IPhysicsSystem;
}

export interface DeathFiringResult {
  agentEntity: number;
  reason: 'tilt' | 'contact' | 'timeout';
}

export class DeathEvaluator {
  private readonly physics: IPhysicsSystem;
  /** Per-entity attached rules. Entries without a rule are skipped. */
  private readonly rulesByEntity = new Map<number, DeathRule>();

  constructor(opts: DeathEvaluatorOptions) {
    this.physics = opts.physics;
  }

  attach(entity: number, rule: DeathRule): void {
    this.rulesByEntity.set(entity, rule);
  }

  detach(entity: number): void {
    this.rulesByEntity.delete(entity);
  }

  /** Evaluate every attached rule. Returns a list of agents that just died. */
  evaluate(world: EngineWorld): DeathFiringResult[] {
    const results: DeathFiringResult[] = [];
    for (const [entity, rule] of this.rulesByEntity) {
      const agent = world.getComponent<AgentComponent>(entity, MORPHOLOGY_COMPONENT_KINDS.agent);
      if (!agent || !agent.alive) continue;
      const segs = world.getComponent<SegmentsComponent>(entity, MORPHOLOGY_COMPONENT_KINDS.segments);
      if (!segs) continue;
      const segById = indexSegments(segs.bodies);

      if (rule.deathFromTimeout && agent.stepsSinceSpawn >= rule.deathFromTimeout.maxSteps) {
        agent.alive = false;
        results.push({ agentEntity: entity, reason: 'timeout' });
        continue;
      }

      if (rule.deathFromTilt) {
        const seg = segById.get(rule.deathFromTilt.segmentId);
        if (seg) {
          const t = this.physics.getBodyTransform(seg.bodyHandle);
          const localUp = applyQuat(t.rotation, { x: 0, y: 1, z: 0 });
          const angle = Math.acos(clamp(localUp.y, -1, 1));
          if (angle > rule.deathFromTilt.toleranceRadians) {
            agent.alive = false;
            results.push({ agentEntity: entity, reason: 'tilt' });
            continue;
          }
        }
      }

      if (rule.deathFromContact) {
        const seg = segById.get(rule.deathFromContact.segmentId);
        if (seg) {
          const t = this.physics.getBodyTransform(seg.bodyHandle);
          const hits = this.physics.queryOverlap({
            kind: 'sphere',
            radius: 0.05,
            center: { ...t.position },
          });
          for (const h of hits) {
            if (h.userTag) {
              for (const kind of rule.deathFromContact.voxelKinds) {
                if (h.userTag.includes(kind)) {
                  agent.alive = false;
                  results.push({ agentEntity: entity, reason: 'contact' });
                  break;
                }
              }
            }
          }
        }
      }
    }
    return results;
  }
}

function indexSegments(segs: SegmentEntry[]): Map<string, SegmentEntry> {
  const m = new Map<string, SegmentEntry>();
  for (const s of segs) m.set(s.id, s);
  return m;
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

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
