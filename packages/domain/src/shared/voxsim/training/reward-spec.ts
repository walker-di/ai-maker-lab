/**
 * Reward weighting and per-step shaping. The trainer multiplies the
 * `metricBreakdown` by `weights` when computing per-step scalars and
 * episode totals.
 */

import type { Vec3 } from '../vec.js';

export interface RewardWeights {
  forwardVelocity?: number;
  uprightness?: number;
  energyPenalty?: number;
  goalProgress?: number;
  survivalTime?: number;
  foodEaten?: number;
  fallPenalty?: number;
}

export interface RewardSpec {
  weights: RewardWeights;
  /** World-space direction the agent should move along. Default `(0,0,1)`. */
  forwardAxis: Vec3;
  /** Local axis on `uprightSegmentTag` expected to align with world up. Default `(0,1,0)`. */
  uprightAxis: Vec3;
  uprightSegmentTag: string;
  terminalBonus?: number;
  terminalPenalty?: number;
}

export const DEFAULT_REWARD_WEIGHTS: Required<RewardWeights> = {
  forwardVelocity: 1,
  uprightness: 0.5,
  energyPenalty: 0.001,
  goalProgress: 0,
  survivalTime: 0.01,
  foodEaten: 0,
  fallPenalty: 1,
};
