/**
 * Stage-based curriculum. The orchestrator advances stages when the rolling
 * window over the chosen metric meets the threshold.
 */

import type { RewardSpec } from './reward-spec.js';

export type CurriculumMetric = 'meanReward' | 'goalRate' | 'survivalSteps';

export interface CurriculumSuccessCriterion {
  metric: CurriculumMetric;
  threshold: number;
  /** Number of generations to average over before checking the threshold. */
  window: number;
}

export interface CurriculumStage {
  arenaId: string;
  successCriterion: CurriculumSuccessCriterion;
  maxGenerations?: number;
  rewardOverride?: RewardSpec;
}

export interface Curriculum {
  stages: CurriculumStage[];
}
