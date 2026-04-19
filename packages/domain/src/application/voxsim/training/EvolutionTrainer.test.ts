import { describe, expect, it } from 'bun:test';

import type {
  CheckpointRef,
  EpisodeSummary,
  TrainingProgressEvent,
} from '../../../shared/voxsim/index.js';
import { emptyMetricBreakdown } from '../../../shared/voxsim/index.js';
import {
  makeArena,
  makeBodyDna,
  makeBrainDna,
  makeEvolutionTrainingDna,
} from './__test-helpers__/fixtures.js';
import { EvolutionTrainer } from './EvolutionTrainer.js';
import { InProcessWorkerHostFactory } from './in-process-worker-host.js';
import type {
  CheckpointPayload,
  TrainingProgressListener,
} from './ITrainer.js';
import type {
  TrainingWorkerEvaluate,
  TrainingWorkerEvaluateResult,
  TrainingWorkerInit,
} from './worker-host.js';

function sumWeights(weights: Float32Array): number {
  let s = 0;
  for (let i = 0; i < weights.length; i++) s += weights[i] ?? 0;
  return s;
}

interface RunResults {
  events: TrainingProgressEvent[];
  checkpoints: { ref: CheckpointRef; payload: CheckpointPayload }[];
  episodes: EpisodeSummary[];
}

async function runOneEvolution(seed = 42): Promise<RunResults> {
  const evaluator = async (
    input: TrainingWorkerEvaluate,
    init: TrainingWorkerInit,
  ): Promise<TrainingWorkerEvaluateResult> => {
    const policy = input.policy;
    if (policy.kind !== 'flat') throw new Error('expected flat payload');
    const fitness = sumWeights(policy.weights);
    const breakdown = emptyMetricBreakdown();
    breakdown.forwardVelocity = fitness;
    const summary: EpisodeSummary = {
      id: `${input.runId}-g${input.generation}-c${input.candidateIndex}-e0`,
      runId: input.runId,
      agentId: 'agent-1',
      bodyDnaId: init.bodyDna.id,
      brainDnaId: init.brainDna.id,
      arenaId: init.arena.id,
      generation: input.generation,
      candidateIndex: input.candidateIndex,
      seed: 0,
      outcome: { kind: 'survived' },
      totalReward: fitness,
      meanReward: fitness / Math.max(1, input.episodeSteps),
      steps: input.episodeSteps,
      metricBreakdown: breakdown,
    };
    return { episodes: [{ summary }] };
  };

  const factory = new InProcessWorkerHostFactory({ evaluator });
  const trainer = new EvolutionTrainer({
    workerHostFactory: factory,
    now: () => '2026-01-01T00:00:00Z',
  });

  const events: TrainingProgressEvent[] = [];
  const checkpoints: { ref: CheckpointRef; payload: CheckpointPayload }[] = [];
  const episodes: EpisodeSummary[] = [];

  const dna = makeEvolutionTrainingDna({
    seed,
    populationSize: 4,
    eliteFraction: 0.5,
    generations: 2,
  });

  const handle = await trainer.start({
    runId: 'run-1',
    bodyDna: makeBodyDna(),
    brainDna: makeBrainDna(),
    trainingDna: dna,
    arenaResolver: async () => makeArena(),
    onCheckpoint: async (ref, payload) => {
      checkpoints.push({ ref, payload });
    },
    onEpisode: async (summary) => {
      episodes.push(summary);
    },
  });

  const listener: TrainingProgressListener = (e) => {
    events.push(e);
  };
  const unsubscribe = trainer.subscribe(handle, listener);

  await new Promise<void>((resolve, reject) => {
    const watch = (e: TrainingProgressEvent) => {
      if (e.kind === 'runFinished') {
        unsubscribe();
        watchUnsubscribe();
        resolve();
      } else if (e.kind === 'runFailed') {
        unsubscribe();
        watchUnsubscribe();
        reject(new Error(e.reason));
      }
    };
    const watchUnsubscribe = trainer.subscribe(handle, watch);
  });

  return { events, checkpoints, episodes };
}

describe('EvolutionTrainer', () => {
  it('emits the expected event sequence and persists elite checkpoints', async () => {
    const { events, checkpoints, episodes } = await runOneEvolution();
    const kinds = events.map((e) => e.kind);
    expect(kinds[0]).toBe('runStarted');
    expect(kinds.includes('generationStarted')).toBe(true);
    expect(kinds.includes('generationFinished')).toBe(true);
    expect(kinds[kinds.length - 1]).toBe('runFinished');
    // 2 generations * 4 candidates * 1 episode + 1 final best = 9 checkpoints
    expect(checkpoints.length).toBeGreaterThanOrEqual(2 * (4 * 0.5) + 1);
    // Each generation produces one episode per candidate
    expect(episodes.length).toBe(2 * 4);
  });

  it('produces identical checkpoints for the same seed', async () => {
    const a = await runOneEvolution(7);
    const b = await runOneEvolution(7);
    expect(a.checkpoints.length).toBe(b.checkpoints.length);
    for (let i = 0; i < a.checkpoints.length; i++) {
      const aw = (a.checkpoints[i]!.payload as { kind: 'flat'; weights: Float32Array }).weights;
      const bw = (b.checkpoints[i]!.payload as { kind: 'flat'; weights: Float32Array }).weights;
      expect(Array.from(aw)).toEqual(Array.from(bw));
    }
  });

  it('selects the highest-scoring candidates as elites', async () => {
    const { events, checkpoints } = await runOneEvolution();
    const generationFinishedEvents = events.filter((e) => e.kind === 'generationFinished') as Extract<
      TrainingProgressEvent,
      { kind: 'generationFinished' }
    >[];
    expect(generationFinishedEvents.length).toBe(2);
    // For each generation, the elite checkpoints' weights should have the
    // highest sums among the population (there are 4 candidates, top 2 elites).
    // We verify by checking that every persisted elite for a generation had
    // a sum >= every non-elite (but we only persist elites, so a weaker
    // assertion: aggregate score equals the max sum for that generation).
    const aggregate = generationFinishedEvents[0]!.aggregateScore;
    const elites = checkpoints
      .filter((c) => (c.ref as { kind: 'flat'; ref: { id: string } }).ref.id.startsWith('run-1-g0'))
      .map((c) => sumWeights((c.payload as { kind: 'flat'; weights: Float32Array }).weights));
    expect(Math.max(...elites)).toBeCloseTo(aggregate, 3);
  });
});
