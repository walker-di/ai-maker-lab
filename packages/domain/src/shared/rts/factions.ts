export type AiDifficulty = 'easy' | 'normal' | 'hard';

export interface Faction {
  id: string;
  label: string;
  /** CSS color string. */
  color: string;
  isPlayer: boolean;
  isAi: boolean;
  aiDifficulty?: AiDifficulty;
}
