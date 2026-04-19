import { describe, expect, it } from 'bun:test';

import type {
  CheckpointRef,
  EpisodeSummary,
  NeatGenome,
  TrainingDna,
  TrainingProgressEvent,
} from '../../../../shared/voxsim/index.js';
import { emptyMetricBreakdown } from '../../../../shared/voxsim/index.js';
import {
  makeArena,
  makeBodyDna,
  makeBrainDna,
  makeReward,
} from '../__test-helpers__/fixtures.js';
import { InProcessWorkerHostFactory } from '../in-process-worker-host.js';
import type {
  CheckpointPayload,
  TrainingProgressListener,
} from '../ITrainer.js';
import type {
  TrainingWorkerEvaluate,
  TrainingWorkerEvaluateResult,
  TrainingWorkerInit,
} from '../worker-host.js';
import { NeatTrainer } from './NeatTrainer.js';

function makeNeatDna(): TrainingDna {
  return {
    id: 'tr-neat',
    version: 1,
    algorithm: 'neat',
    populationSize: 0,
    eliteFraction: 0.5,
    generations: 2,
    episodesPerCandidate: 1,
    episodeSteps: 5,
    mutation: { weightMutationStd: 0.05, weightMutationProb: 0.1, weightCrossoverProb: 0.3 },
    reward: makeReward(),
    curriculum: {
      stages: [
        {
          arenaId: 'flat-arena',
          successCriterion: { metric: 'meanReward', threshold: 1e9, window: 1 },
        },
      ],
    },
    seed: 13,
    maxConcurrentWorkers: 2,
    metadata: {
      name: 'neat-test',
      author: 'tests',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    neat: {
      populationSize: 6,
      eliteFraction: 0.34,
      speciation: {
        compatibilityThreshold: 3,
        c1ExcessCoeff: 1,
        c2DisjointCoeff: 1,
        c3WeightCoeff: 0.4,
      },
      mutation: {
        weightPerturbProb: 0.8,
        weightPerturbStd: 0.1,
        weightReplaceProb: 0.05,
        addConnectionProb: 0.5,
        addNodeProb: 0.3,
        toggleEnabledProb: 0.0,
        initialWeightRange: 1,
      },
      crossover: { interspeciesProb: 0, disabledGeneInheritsDisabledProb: 0.75 },
      survival: { stagnationCutoffGenerations: 15, minSpeciesSize: 1 },
    },
  };
}

function fitnessOfGenome(g: NeatGenome): number {
  let s = 0;
  for (const c of g.connections) s += c.weight;
  return s;
}

async function runNeat(): Promise<{
  events: TrainingProgressEvent[];
  checkpoints: { ref: CheckpointRef; payload: CheckpointPayload }[];
  episodes: EpisodeSummary[];
}> {
  const evaluator = async (
    input: TrainingWorkerEvaluate,
    init: TrainingWorkerInit,
  ): Promise<TrainingWorkerEvaluateResult> => {
    if (input.policy.kind !== 'neatGenome') throw new Error('expected neatGenome');
    const fitness = fitnessOfGenome(input.policy.genome);
    const breakdown = emptyMetricBreakdown();
    breakdown.forwardVelocity = fitness;
    const summary: EpisodeSummary = {
      id: `${input.runId}-g${input.generation}-c${input.candidateIndex}`,
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

  const trainer = new NeatTrainer({
    workerHostFactory: new InProcessWorkerHostFactory({ evaluator }),
    now: () => '2026-01-01T00:00:00Z',
  });

  const events: TrainingProgressEvent[] = [];
  const checkpoints: { ref: CheckpointRef; payload: CheckpointPayload }[] = [];
  const episodes: EpisodeSummary[] = [];

  const handle = await trainer.start({
    runId: 'run-neat',
    bodyDna: makeBodyDna(),
    brainDna: makeBrainDna(),
    trainingDna: makeNeatDna(),
    arenaResolver: async () => makeArena(),
    onCheckpoint: async (ref, payload) => {
      checkpoints.push({ ref, payload });
    },
    onEpisode: async (summary) => {
      episodes.push(summary);
    },
  });

  const listener: TrainingProgressListener = (e) => events.push(e);
  const unsub = trainer.subscribe(handle, listener);

  await new Promise<void>((resolve, reject) => {
    const watch = trainer.subscribe(handle, (e) => {
      if (e.kind === 'runFinished') {
        watch();
        unsub();
        resolve();
      } else if (e.kind === 'runFailed') {
        watch();
        unsub();
        reject(new Error(e.reason));
      }
    });
  });

  return { events, checkpoints, episodes };
}

describe('NeatTrainer', () => {
  it('emits species and innovations events and persists genome checkpoints', async () => {
    const { events, checkpoints } = await runNeat();
    const kinds = events.map((e) => e.kind);
    expect(kinds[0]).toBe('runStarted');
    expect(kinds[kinds.length - 1]).toBe('runFinished');
    expect(kinds).toContain('speciesUpdated');
    expect(kinds).toContain('generationFinished');
    // every persisted checkpoint should be of kind neatGenome
    expect(checkpoints.every((c) => c.ref.kind === 'neatGenome')).toBe(true);
    // at least the final best is persisted
    expect(checkpoints.length).toBeGreaterThan(0);
  });

  it('produces deterministic generation 0 genomes for the same seed', async () => {
    const a = await runNeat();
    const b = await runNeat();
    // The first checkpoint of each run should match the same generation 0 elites
    const aGen0 = a.checkpoints
      .filter((c) => c.ref.kind === 'neatGenome' && (c.ref as { kind: 'neatGenome'; generation: number }).generation === 0)
      .map((c) => (c.payload as { kind: 'neatGenome'; genome: NeatGenome }).genome.connections.map((cn) => cn.weight));
    const bGen0 = b.checkpoints
      .filter((c) => c.ref.kind === 'neatGenome' && (c.ref as { kind: 'neatGenome'; generation: number }).generation === 0)
      .map((c) => (c.payload as { kind: 'neatGenome'; genome: NeatGenome }).genome.connections.map((cn) => cn.weight));
    expect(aGen0).toEqual(bGen0);
  });
});
