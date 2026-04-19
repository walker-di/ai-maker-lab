import { describe, expect, it } from 'bun:test';

import type {
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
import { InProcessWorkerHostFactory } from './in-process-worker-host.js';
import { TrainerOrchestrator } from './TrainerOrchestrator.js';
import type {
  TrainingWorkerEvaluate,
  TrainingWorkerEvaluateResult,
  TrainingWorkerInit,
} from './worker-host.js';

describe('TrainerOrchestrator', () => {
  it('routes evolution algorithm to the EvolutionTrainer and emits a complete event sequence', async () => {
    const evaluator = async (
      input: TrainingWorkerEvaluate,
      init: TrainingWorkerInit,
    ): Promise<TrainingWorkerEvaluateResult> => {
      const breakdown = emptyMetricBreakdown();
      breakdown.forwardVelocity = input.candidateIndex;
      const summary: EpisodeSummary = {
        id: `${input.runId}-g${input.generation}-c${input.candidateIndex}`,
        runId: input.runId,
        agentId: 'agent',
        bodyDnaId: init.bodyDna.id,
        brainDnaId: init.brainDna.id,
        arenaId: init.arena.id,
        generation: input.generation,
        candidateIndex: input.candidateIndex,
        seed: 0,
        outcome: { kind: 'survived' },
        totalReward: input.candidateIndex,
        meanReward: input.candidateIndex,
        steps: input.episodeSteps,
        metricBreakdown: breakdown,
      };
      return { episodes: [{ summary }] };
    };

    const orchestrator = new TrainerOrchestrator({
      workerHostFactory: new InProcessWorkerHostFactory({ evaluator }),
      now: () => '2026-01-01T00:00:00Z',
    });

    const events: TrainingProgressEvent[] = [];
    const handle = await orchestrator.start({
      runId: 'orch-1',
      bodyDna: makeBodyDna(),
      brainDna: makeBrainDna(),
      trainingDna: makeEvolutionTrainingDna({ generations: 1 }),
      arenaResolver: async () => makeArena(),
      onCheckpoint: async () => undefined,
      onEpisode: async () => undefined,
    });

    await new Promise<void>((resolve, reject) => {
      const unsub = orchestrator.subscribe(handle, (e) => {
        events.push(e);
        if (e.kind === 'runFinished') {
          unsub();
          resolve();
        } else if (e.kind === 'runFailed') {
          unsub();
          reject(new Error(e.reason));
        }
      });
    });

    const kinds = events.map((e) => e.kind);
    expect(kinds[0]).toBe('runStarted');
    expect(kinds).toContain('generationFinished');
    expect(kinds[kinds.length - 1]).toBe('runFinished');
  });

  it('throws for unsupported algorithms (reinforce/ppoLite v1 stubs)', async () => {
    const orchestrator = new TrainerOrchestrator({
      workerHostFactory: new InProcessWorkerHostFactory({
        evaluator: async () => ({ episodes: [] }),
      }),
    });

    await expect(
      orchestrator.start({
        runId: 'rf-1',
        bodyDna: makeBodyDna(),
        brainDna: makeBrainDna(),
        trainingDna: makeEvolutionTrainingDna({
          algorithm: 'reinforce',
          optimizer: { kind: 'sgd', lr: 0.01 },
        }),
        arenaResolver: async () => makeArena(),
        onCheckpoint: async () => undefined,
        onEpisode: async () => undefined,
      }),
    ).rejects.toThrow();
  });
});
