import type { PowerUpKind } from '../types.js';

/**
 * Presentation model for the platformer HUD. Holds reactive runtime stats so
 * the HUD component can re-render when engine events fire. Owned by the
 * runtime page model.
 */
export interface PlatformerHudState {
  lives: number;
  score: number;
  coins: number;
  /** Remaining time in seconds, rounded down. */
  time: number;
  worldLabel: string;
  power: PowerUpKind;
  paused: boolean;
}

export class PlatformerHudModel {
  state = $state<PlatformerHudState>({
    lives: 3,
    score: 0,
    coins: 0,
    time: 300,
    worldLabel: '1-1',
    power: 'none',
    paused: false,
  });

  setLives(lives: number): void { this.state.lives = lives; }
  setScore(score: number): void { this.state.score = score; }
  setCoins(coins: number): void { this.state.coins = coins; }
  setTimeMs(ms: number): void { this.state.time = Math.max(0, Math.floor(ms / 1000)); }
  setWorldLabel(label: string): void { this.state.worldLabel = label; }
  setPower(power: PowerUpKind): void { this.state.power = power; }
  setPaused(paused: boolean): void { this.state.paused = paused; }
  reset(opts?: Partial<PlatformerHudState>): void {
    this.state = {
      lives: opts?.lives ?? 3,
      score: opts?.score ?? 0,
      coins: opts?.coins ?? 0,
      time: opts?.time ?? 300,
      worldLabel: opts?.worldLabel ?? '1-1',
      power: opts?.power ?? 'none',
      paused: opts?.paused ?? false,
    };
  }
}

export function createPlatformerHudModel(): PlatformerHudModel {
  return new PlatformerHudModel();
}
