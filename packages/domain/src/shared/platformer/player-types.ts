export const POWER_UP_KINDS = ['none', 'grow', 'fire', 'star'] as const;

export type PowerUpKind = (typeof POWER_UP_KINDS)[number];

export interface PlayerProfile {
  lives: number;
  score: number;
  coins: number;
  power: PowerUpKind;
  checkpoint?: { worldId: string; levelId: string };
}

export function createDefaultPlayerProfile(): PlayerProfile {
  return {
    lives: 3,
    score: 0,
    coins: 0,
    power: 'none',
  };
}
