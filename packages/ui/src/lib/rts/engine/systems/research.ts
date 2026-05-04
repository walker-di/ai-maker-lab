import { COMPONENT_KINDS as C } from '../components.js';
import type {
  CombatComponent,
  FactionComponent,
  HealthComponent,
  ResearchQueueComponent,
  VisionComponent,
} from '../components.js';
import type { EngineWorld, System, SystemContext } from '../world.js';
import type { TechKind } from '../../types.js';
import { TECH_STATS } from '../../types.js';

/**
 * Tracks cumulative stat deltas that have been applied to a faction's live
 * units. Stored externally by the engine; the system reads it on apply.
 */
export interface FactionTechState {
  researched: Set<TechKind>;
  /** Sum of all armorBonus from completed techs. */
  totalArmorBonus: number;
  /** Sum of all damageBonus from completed techs. */
  totalDamageBonus: number;
  /** Sum of all sightBonus from completed techs. */
  totalSightBonus: number;
}

export function createFactionTechState(): FactionTechState {
  return {
    researched: new Set(),
    totalArmorBonus: 0,
    totalDamageBonus: 0,
    totalSightBonus: 0,
  };
}

/**
 * Ticks all `researchQueue` components, completing research after the timer
 * expires. On completion it emits a `researchCompleted` system event and
 * applies the stat delta to every live unit of the researching faction.
 */
export class ResearchSystem implements System {
  readonly name = 'research';

  constructor(
    private readonly factionTech: Map<string, FactionTechState>,
  ) {}

  update(world: EngineWorld, dt: number, ctx: SystemContext): void {
    const dtMs = dt * 1000;

    for (const id of world.query([C.researchQueue, C.faction])) {
      const queue = world.getComponent<ResearchQueueComponent>(id, C.researchQueue)!;
      const faction = world.getComponent<FactionComponent>(id, C.faction)!;
      if (queue.items.length === 0) continue;

      const item = queue.items[0]!;
      item.remainingMs -= dtMs;

      if (item.remainingMs <= 0) {
        queue.items.shift();
        const tech = this.factionTech.get(faction.factionId);
        if (tech) {
          tech.researched.add(item.kind);
          const effects = TECH_STATS[item.kind].effects;
          if (effects.armorBonus) tech.totalArmorBonus += effects.armorBonus;
          if (effects.damageBonus) tech.totalDamageBonus += effects.damageBonus;
          if (effects.sightBonus) tech.totalSightBonus += effects.sightBonus;
          applyStatDeltaToFaction(world, faction.factionId, TECH_STATS[item.kind].effects);
        }
        ctx.bus.emit({
          type: 'researchCompleted',
          factionId: faction.factionId,
          kind: item.kind,
          researcherId: id,
        });
      }
    }
  }
}

/**
 * Applies incremental stat deltas to all live units belonging to `factionId`.
 * Called once per completed tech, not re-applied on recount.
 */
function applyStatDeltaToFaction(
  world: EngineWorld,
  factionId: string,
  effects: { armorBonus?: number; damageBonus?: number; sightBonus?: number },
): void {
  for (const id of world.query([C.faction])) {
    const faction = world.getComponent<FactionComponent>(id, C.faction)!;
    if (faction.factionId !== factionId) continue;

    if (effects.armorBonus) {
      const hp = world.getComponent<HealthComponent>(id, C.health);
      if (hp) hp.armor += effects.armorBonus;
    }
    if (effects.damageBonus) {
      const combat = world.getComponent<CombatComponent>(id, C.combat);
      if (combat) combat.damage += effects.damageBonus;
    }
    if (effects.sightBonus) {
      const vision = world.getComponent<VisionComponent>(id, C.vision);
      if (vision) vision.sight += effects.sightBonus;
    }
  }
}
