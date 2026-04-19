/**
 * Reward computation helpers used by both `TrainingWorker` and trainer
 * aggregation logic. Pure functions; no engine references.
 */

import type {
  EpisodeMetricBreakdown,
  EpisodeSummary,
  RewardSpec,
  RewardWeights,
} from '../../../shared/voxsim/index.js';
import { DEFAULT_REWARD_WEIGHTS } from '../../../shared/voxsim/index.js';

function weight(weights: RewardWeights, key: keyof RewardWeights): number {
  return weights[key] ?? DEFAULT_REWARD_WEIGHTS[key];
}

/**
 * Project a `metricBreakdown` to a scalar fitness using the spec's weights.
 * `forwardVelocity`, `uprightness`, `goalProgress`, `survivalTime`, and
 * `foodEaten` add. `energyPenalty` and `fallPenalty` subtract.
 */
export function fitnessFromBreakdown(
  breakdown: EpisodeMetricBreakdown,
  spec: RewardSpec,
): number {
  const w = spec.weights;
  return (
    weight(w, 'forwardVelocity') * breakdown.forwardVelocity +
    weight(w, 'uprightness') * breakdown.uprightness +
    weight(w, 'goalProgress') * breakdown.goalProgress +
    weight(w, 'survivalTime') * breakdown.survivalTime +
    weight(w, 'foodEaten') * breakdown.foodEaten -
    weight(w, 'energyPenalty') * breakdown.energyPenalty -
    weight(w, 'fallPenalty') * breakdown.fallPenalty
  );
}

/**
 * Mean fitness across multiple episodes. Returns `0` for empty inputs to
 * keep the caller's loop arithmetic simple.
 */
export function meanFitness(
  episodes: readonly EpisodeSummary[],
  spec: RewardSpec,
): number {
  if (episodes.length === 0) return 0;
  let sum = 0;
  for (const e of episodes) {
    sum += fitnessFromBreakdown(e.metricBreakdown, spec);
  }
  return sum / episodes.length;
}

/**
 * Apply terminal bonuses/penalties from the reward spec to a per-step total.
 */
export function applyTerminalReward(
  total: number,
  outcome: EpisodeSummary['outcome'],
  spec: RewardSpec,
): number {
  if (outcome.kind === 'goalReached' && spec.terminalBonus !== undefined) {
    return total + spec.terminalBonus;
  }
  if (outcome.kind === 'died' && spec.terminalPenalty !== undefined) {
    return total - spec.terminalPenalty;
  }
  return total;
}
