/**
 * `EvolutionTrainer` runs Gaussian-mutation neuroevolution over fixed-topology
 * brain weights. Each candidate is evaluated by a `WorkerHost`. The trainer
 * stays algorithm-only: it does not spawn workers itself, the orchestrator
 * owns the pool.
 */

import type {
  BrainDna,
  EpisodeSummary,
  TrainingDna,
  TrainingProgressEvent,
  WeightLayout,
} from '../../../shared/voxsim/index.js';
import { buildWeightLayout, layoutTotalLength } from '../../../shared/voxsim/index.js';
import type {
  ITrainer,
  TrainerStartInput,
  TrainingProgressListener,
  TrainingRunHandle,
  Unsubscribe,
} from './ITrainer.js';
import { createMulberry32, type SeededPrng } from './prng.js';
import { meanFitness } from './reward.js';
import type { WorkerHost, WorkerHostFactory } from './worker-host.js';

export interface EvolutionTrainerOptions {
  workerHostFactory: WorkerHostFactory;
  /** Optional clock injection for stable timestamps in tests. */
  now?: () => string;
}

interface ActiveRun {
  handle: TrainingRunHandle;
  listeners: Set<TrainingProgressListener>;
  cancellation: { aborted: boolean };
  paused: boolean;
  /** Events buffered before any listener attaches; drained on first subscribe. */
  pending: TrainingProgressEvent[];
}

function defaultNow(): string {
  return new Date().toISOString();
}

function deriveSeed(master: number, offset: number): number {
  return ((master | 0) + Math.imul(offset | 0, 0x9e3779b1)) | 0;
}

function initialWeightsFor(
  layout: WeightLayout,
  prng: SeededPrng,
  scale = 0.1,
): Float32Array {
  const length = layoutTotalLength(layout);
  const weights = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    weights[i] = prng.nextGaussian() * scale;
  }
  return weights;
}

function emit(run: ActiveRun, event: TrainingProgressEvent): void {
  if (run.listeners.size === 0) {
    run.pending.push(event);
    return;
  }
  for (const l of run.listeners) {
    try {
      l(event);
    } catch {
      // Listener errors must not abort the trainer.
    }
  }
}

function checkpointId(runId: string, generation: number, candidateIndex: number): string {
  return `${runId}-g${generation}-c${candidateIndex}`;
}

export class EvolutionTrainer implements ITrainer {
  readonly id = 'evolution-trainer';
  readonly kind = 'evolution' as const;

  private active = new Map<string, ActiveRun>();
  private readonly now: () => string;

  constructor(private readonly options: EvolutionTrainerOptions) {
    this.now = options.now ?? defaultNow;
  }

  async start(input: TrainerStartInput): Promise<TrainingRunHandle> {
    if (input.trainingDna.algorithm !== 'evolution') {
      throw new Error(
        `EvolutionTrainer cannot run algorithm '${input.trainingDna.algorithm}'`,
      );
    }
    const handle: TrainingRunHandle = { runId: input.runId };
    const run: ActiveRun = {
      handle,
      listeners: new Set(),
      cancellation: { aborted: false },
      paused: false,
      pending: [],
    };
    this.active.set(handle.runId, run);
    setTimeout(() => {
      this.runLoop(run, input).catch((error) => {
        emit(run, {
          kind: 'runFailed',
          runId: handle.runId,
          status: 'failed',
          reason: error instanceof Error ? error.message : String(error),
        });
        this.active.delete(handle.runId);
      });
    }, 0);
    return handle;
  }

  async pause(handle: TrainingRunHandle): Promise<void> {
    const run = this.active.get(handle.runId);
    if (run) run.paused = true;
  }

  async resume(handle: TrainingRunHandle): Promise<void> {
    const run = this.active.get(handle.runId);
    if (run) run.paused = false;
  }

  async stop(handle: TrainingRunHandle): Promise<void> {
    const run = this.active.get(handle.runId);
    if (run) run.cancellation.aborted = true;
  }

  subscribe(handle: TrainingRunHandle, listener: TrainingProgressListener): Unsubscribe {
    const run = this.active.get(handle.runId);
    if (!run) {
      throw new Error(`unknown run '${handle.runId}'`);
    }
    run.listeners.add(listener);
    if (run.pending.length > 0) {
      const drained = run.pending.slice();
      run.pending.length = 0;
      for (const e of drained) {
        try {
          listener(e);
        } catch {
          // ignore listener errors
        }
      }
    }
    return () => {
      run.listeners.delete(listener);
    };
  }

  private async waitWhilePaused(run: ActiveRun): Promise<void> {
    while (run.paused && !run.cancellation.aborted) {
      await new Promise((r) => setTimeout(r, 10));
    }
  }

  private async runLoop(run: ActiveRun, input: TrainerStartInput): Promise<void> {
    emit(run, {
      kind: 'runStarted',
      runId: input.runId,
      status: 'running',
      startedAt: this.now(),
    });

    const layout = this.computeLayout(input.brainDna);
    const dna = input.trainingDna;
    const populationSize = Math.max(1, dna.populationSize);
    const eliteCount = Math.max(1, Math.floor(dna.eliteFraction * populationSize));

    const masterPrng = createMulberry32(dna.seed);

    let population: Float32Array[] = [];
    for (let i = 0; i < populationSize; i++) {
      const initSeed = deriveSeed(dna.seed, i);
      const seedPrng = createMulberry32(initSeed);
      const w = i === 0 && input.initialWeights
        ? new Float32Array(input.initialWeights)
        : initialWeightsFor(layout, seedPrng);
      population.push(w);
    }

    let bestEverWeights = new Float32Array(population[0]!);
    let bestEverFitness = Number.NEGATIVE_INFINITY;
    const bytesPerWeight = layoutTotalLength(layout) * 4;
    let bestEverRef = {
      kind: 'flat' as const,
      ref: {
        id: checkpointId(input.runId, 0, 0),
        brainDnaId: input.brainDna.id,
        bytes: bytesPerWeight,
        createdAt: this.now(),
      },
    };

    let stageIndex = 0;
    const rollingScores: number[] = [];

    for (let generation = 0; generation < dna.generations; generation++) {
      if (run.cancellation.aborted) break;
      await this.waitWhilePaused(run);

      const stage = dna.curriculum.stages[stageIndex];
      if (!stage) break;
      const arena = await input.arenaResolver(stage.arenaId);

      emit(run, {
        kind: 'generationStarted',
        runId: input.runId,
        generation,
        arenaId: stage.arenaId,
      });

      const fitnesses = new Array<number>(population.length).fill(0);
      const concurrency = Math.max(1, dna.maxConcurrentWorkers);
      let nextIndex = 0;

      const runOne = async (host: WorkerHost): Promise<void> => {
        await host.init({
          bodyDna: input.bodyDna,
          brainDna: input.brainDna,
          arena,
          reward: stage.rewardOverride ?? dna.reward,
          replaySampleStride: dna.replaySampleStride ?? 2,
          seed: deriveSeed(dna.seed, generation * 1000 + nextIndex),
        });
        try {
          while (true) {
            if (run.cancellation.aborted) return;
            await this.waitWhilePaused(run);
            const myIndex = nextIndex++;
            if (myIndex >= population.length) return;
            const result = await host.evaluate({
              runId: input.runId,
              generation,
              candidateIndex: myIndex,
              policy: { kind: 'flat', weights: population[myIndex]! },
              episodesPerCandidate: dna.episodesPerCandidate,
              episodeSteps: dna.episodeSteps,
            });
            for (const ep of result.episodes) {
              await input.onEpisode(ep.summary, ep.replay);
              emit(run, { kind: 'episodeFinished', runId: input.runId, episode: ep.summary });
            }
            fitnesses[myIndex] = meanFitness(
              result.episodes.map((e) => e.summary) as EpisodeSummary[],
              stage.rewardOverride ?? dna.reward,
            );
          }
        } finally {
          await host.dispose();
        }
      };

      const hosts: WorkerHost[] = [];
      for (let h = 0; h < concurrency; h++) hosts.push(this.options.workerHostFactory.create());
      await Promise.all(hosts.map((h) => runOne(h)));

      // Sort by fitness descending and pick elites.
      const ordered = fitnesses
        .map((f, idx) => ({ f, idx }))
        .sort((a, b) => b.f - a.f);
      const elites = ordered.slice(0, eliteCount).map((o) => o.idx);
      const eliteRefs = [];
      for (let i = 0; i < elites.length; i++) {
        const idx = elites[i]!;
        const ref = {
          kind: 'flat' as const,
          ref: {
            id: checkpointId(input.runId, generation, idx),
            brainDnaId: input.brainDna.id,
            bytes: bytesPerWeight,
            score: ordered[i]!.f,
            generation,
            createdAt: this.now(),
          },
        };
        await input.onCheckpoint(ref, { kind: 'flat', weights: population[idx]! });
        eliteRefs.push(ref);
      }

      const bestThisGen = ordered[0]!;
      if (bestThisGen.f > bestEverFitness) {
        bestEverFitness = bestThisGen.f;
        bestEverWeights = new Float32Array(population[bestThisGen.idx]!);
        bestEverRef = eliteRefs[0]!;
      }
      const aggregate = bestThisGen.f;

      emit(run, {
        kind: 'generationFinished',
        runId: input.runId,
        generation,
        aggregateScore: aggregate,
        eliteCheckpointRefs: eliteRefs,
      });

      // Build next generation
      const next: Float32Array[] = [];
      for (const idx of elites) next.push(new Float32Array(population[idx]!));
      while (next.length < populationSize) {
        const parentA = population[elites[Math.floor(masterPrng.next() * elites.length)]!]!;
        const parentB = population[elites[Math.floor(masterPrng.next() * elites.length)]!]!;
        const child = new Float32Array(parentA.length);
        for (let j = 0; j < parentA.length; j++) {
          child[j] = masterPrng.next() < dna.mutation.weightCrossoverProb ? (parentB[j] ?? 0) : (parentA[j] ?? 0);
          if (masterPrng.next() < dna.mutation.weightMutationProb) {
            child[j] = (child[j] ?? 0) + masterPrng.nextGaussian() * dna.mutation.weightMutationStd;
          }
        }
        next.push(child);
      }
      population = next;

      // Curriculum advancement
      rollingScores.push(aggregate);
      const sc = stage.successCriterion;
      if (rollingScores.length >= sc.window) {
        const window = rollingScores.slice(-sc.window);
        const score = window.reduce((s, v) => s + v, 0) / window.length;
        const passed = score >= sc.threshold;
        if (passed && stageIndex < dna.curriculum.stages.length - 1) {
          emit(run, {
            kind: 'curriculumAdvanced',
            runId: input.runId,
            fromStageIndex: stageIndex,
            toStageIndex: stageIndex + 1,
          });
          stageIndex += 1;
          rollingScores.length = 0;
        }
      }
    }

    // Persist the final best
    await input.onCheckpoint(bestEverRef, { kind: 'flat', weights: bestEverWeights });
    emit(run, {
      kind: 'runFinished',
      runId: input.runId,
      status: run.cancellation.aborted ? 'stopping' : 'completed',
      finishedAt: this.now(),
      bestCheckpointRef: bestEverRef,
    });
    this.active.delete(input.runId);
  }

  private computeLayout(brain: BrainDna): WeightLayout {
    const inputWidth = brain.inputEncoder.inputs.reduce((s, b) => s + b.width, 0);
    const outputWidth = brain.outputDecoder.outputs.length;
    return buildWeightLayout(brain.layers, inputWidth, outputWidth);
  }
}
