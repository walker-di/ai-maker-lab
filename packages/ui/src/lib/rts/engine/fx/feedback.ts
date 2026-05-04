import type { TilePos } from '../../types.js';

export type RtsOrderFeedbackKind = 'move' | 'attack' | 'attack-move' | 'patrol' | 'repair' | 'build-place';
export type RtsImpactKind = 'bullet' | 'rocket' | 'tracer' | 'critical';

export interface RtsOrderRipple {
  id: number;
  tile: TilePos;
  kind: RtsOrderFeedbackKind;
  ageMs: number;
  durationMs: number;
}

export interface RtsImpactFlash {
  id: number;
  tile: TilePos;
  kind: RtsImpactKind;
  ageMs: number;
  durationMs: number;
}

export interface RtsFeedbackSnapshot {
  ripples: readonly RtsOrderRipple[];
  impacts: readonly RtsImpactFlash[];
  combatHeat: number;
  hitStopMs: number;
  cameraShake: { x: number; y: number };
}

let nextRippleId = 1;
let nextImpactId = 1;

export class RtsFeedbackController {
  private ripples: RtsOrderRipple[] = [];
  private impacts: RtsImpactFlash[] = [];
  private combatHeat = 0;
  private hitStopMs = 0;
  private shake = { x: 0, y: 0 };

  step(dtMs: number): void {
    for (const ripple of this.ripples) ripple.ageMs += dtMs;
    this.ripples = this.ripples.filter((ripple) => ripple.ageMs < ripple.durationMs);
    for (const impact of this.impacts) impact.ageMs += dtMs;
    this.impacts = this.impacts.filter((impact) => impact.ageMs < impact.durationMs);
    this.combatHeat = Math.max(0, this.combatHeat - dtMs / 900);
    this.hitStopMs = Math.max(0, this.hitStopMs - dtMs);
    const shakeDecay = Math.max(0, 1 - dtMs / 140);
    this.shake.x *= shakeDecay;
    this.shake.y *= shakeDecay;
  }

  addOrderRipple(tile: TilePos, kind: RtsOrderFeedbackKind): void {
    this.ripples.push({ id: nextRippleId++, tile: { ...tile }, kind, ageMs: 0, durationMs: 520 });
  }

  addImpactFlash(tile: TilePos, kind: RtsImpactKind): void {
    this.impacts.push({
      id: nextImpactId++,
      tile: { ...tile },
      kind,
      ageMs: 0,
      durationMs: kind === 'rocket' || kind === 'critical' ? 520 : 320,
    });
  }

  addCombatHeat(amount = 0.35): void {
    this.combatHeat = Math.min(1, this.combatHeat + amount);
  }

  triggerHitStop(ms: number, direction: { x: number; y: number } = { x: 0, y: 0 }): void {
    this.hitStopMs = Math.max(this.hitStopMs, ms);
    this.shake.x += direction.x * 5;
    this.shake.y += direction.y * 5;
  }

  isHitStopped(): boolean {
    return this.hitStopMs > 0;
  }

  read(): RtsFeedbackSnapshot {
    return {
      ripples: this.ripples.map((ripple) => ({ ...ripple, tile: { ...ripple.tile } })),
      impacts: this.impacts.map((impact) => ({ ...impact, tile: { ...impact.tile } })),
      combatHeat: this.combatHeat,
      hitStopMs: this.hitStopMs,
      cameraShake: { ...this.shake },
    };
  }
}
