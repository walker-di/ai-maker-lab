/**
 * `NeatTrainer` covers the three NEAT-family algorithms (`neat`, `hyperNeat`,
 * `neatLstm`). The orchestrator selects this trainer based on
 * `TrainingDna.algorithm`.
 */

import type {
  CheckpointRef,
  EpisodeSummary,
  NeatGenome,
  NeatTrainingConfig,
  TrainingAlgorithm,
  TrainingProgressEvent,
} from '../../../../shared/voxsim/index.js';
import type {
  ITrainer,
  TrainerStartInput,
  TrainingProgressListener,
  TrainingRunHandle,
  Unsubscribe,
} from '../ITrainer.js';
import { createMulberry32, type SeededPrng } from '../prng.js';
import { meanFitness } from '../reward.js';
import type { WorkerHost, WorkerHostFactory } from '../worker-host.js';
import { InnovationLedger } from './InnovationLedger.js';
import { buildInitialPopulation } from './initial-genome.js';
import {
  cloneGenome,
  crossover,
  mutateAddConnection,
  mutateAddLstmNode,
  mutateAddNode,
  mutateToggleEnabled,
  mutateWeights,
} from './NeatMutationOperators.js';
import { SpeciesRegistry } from './SpeciesRegistry.js';

export interface NeatTrainerOptions {
  workerHostFactory: WorkerHostFactory;
  now?: () => string;
}

interface ActiveRun {
  handle: TrainingRunHandle;
  listeners: Set<TrainingProgressListener>;
  cancellation: { aborted: boolean };
  paused: boolean;
  pending: TrainingProgressEvent[];
}

function defaultNow(): string {
  return new Date().toISOString();
}

function deriveSeed(master: number, offset: number): number {
  return ((master | 0) + Math.imul(offset | 0, 0x9e3779b1)) | 0;
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
      // ignore listener errors
    }
  }
}

function genomeBytes(genome: NeatGenome): number {
  // Rough estimate; persistence layer computes the real number.
  return genome.nodes.length * 16 + genome.connections.length * 24;
}

function makeNeatCheckpointRef(
  runId: string,
  generation: number,
  genome: NeatGenome,
  brainDnaId: string,
  score: number,
  now: string,
): CheckpointRef {
  return {
    kind: 'neatGenome',
    genomeId: genome.id,
    brainDnaId,
    generation,
    bytes: genomeBytes(genome),
    score,
    createdAt: now,
  };
}

export class NeatTrainer implements ITrainer {
  readonly id = 'neat-trainer';
  readonly kind: TrainingAlgorithm = 'neat';

  private active = new Map<string, ActiveRun>();
  private readonly now: () => string;

  constructor(private readonly options: NeatTrainerOptions) {
    this.now = options.now ?? defaultNow;
  }

  async start(input: TrainerStartInput): Promise<TrainingRunHandle> {
    const algorithm = input.trainingDna.algorithm;
    if (algorithm !== 'neat' && algorithm !== 'hyperNeat' && algorithm !== 'neatLstm') {
      throw new Error(`NeatTrainer cannot run algorithm '${algorithm}'`);
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
    const algorithm = input.trainingDna.algorithm as 'neat' | 'hyperNeat' | 'neatLstm';
    const dna = input.trainingDna;
    const neat = dna.neat;
    if (!neat) throw new Error('NEAT config missing');

    emit(run, {
      kind: 'runStarted',
      runId: input.runId,
      status: 'running',
      startedAt: this.now(),
    });

    const ledger = new InnovationLedger();
    let population: NeatGenome[] = input.initialGenomes && input.initialGenomes.length > 0
      ? input.initialGenomes.map((g) => cloneGenome(g, 'init'))
      : buildInitialPopulation({
          algorithm,
          brain: input.brainDna,
          config: neat,
          ledger,
          seed: dna.seed,
          populationSize: neat.populationSize,
        });

    const speciesPrng = createMulberry32(deriveSeed(dna.seed, 0xa11));
    const registry = new SpeciesRegistry({ config: neat.speciation, prng: speciesPrng });

    let bestEverGenome = population[0]!;
    let bestEverFitness = Number.NEGATIVE_INFINITY;
    let bestEverRef: CheckpointRef = makeNeatCheckpointRef(
      input.runId,
      0,
      bestEverGenome,
      input.brainDna.id,
      0,
      this.now(),
    );

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

      registry.beginGeneration();

      // Evaluate population
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
              policy: { kind: 'neatGenome', genome: population[myIndex]! },
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

      // Speciate
      for (let i = 0; i < population.length; i++) {
        registry.assign(population[i]!, fitnesses[i]!, generation);
      }
      registry.endGeneration();

      const speciesIds = registry.speciesIds();
      emit(run, {
        kind: 'speciesUpdated',
        runId: input.runId,
        generation,
        species: registry.snapshot(),
      });
      const innovations = ledger.snapshotForGeneration(generation);
      if (innovations.addedConnections.length > 0 || innovations.addedNodes.length > 0) {
        emit(run, {
          kind: 'innovationsAssigned',
          runId: input.runId,
          generation,
          addedConnections: innovations.addedConnections,
          addedNodes: innovations.addedNodes,
        });
        if (input.onInnovations) {
          await input.onInnovations({
            kind: 'innovationsAssigned',
            runId: input.runId,
            generation,
            addedConnections: innovations.addedConnections,
            addedNodes: innovations.addedNodes,
          });
        }
      }
      if (input.onSpeciesUpdate) {
        await input.onSpeciesUpdate({
          kind: 'speciesUpdated',
          runId: input.runId,
          generation,
          species: registry.snapshot(),
        });
      }

      // Compute adjusted fitnesses + species offspring allotment
      const speciesAdjustedSum = new Map<number, number>();
      for (const sid of speciesIds) {
        const members = registry.membersOf(sid);
        let sum = 0;
        const size = members.length || 1;
        for (const m of members) sum += m.fitness / size;
        speciesAdjustedSum.set(sid, sum);
      }
      const totalAdjusted = Array.from(speciesAdjustedSum.values()).reduce((s, v) => s + v, 0);

      // Persist elites: best of each species
      const eliteRefs: CheckpointRef[] = [];
      let bestThisGen = { genome: bestEverGenome, fitness: Number.NEGATIVE_INFINITY };
      for (const sid of speciesIds) {
        const members = registry.membersOf(sid);
        if (members.length === 0) continue;
        const top = [...members].sort((a, b) => b.fitness - a.fitness)[0]!;
        if (top.fitness > bestThisGen.fitness) {
          bestThisGen = { genome: top.genome, fitness: top.fitness };
        }
        const ref = makeNeatCheckpointRef(
          input.runId,
          generation,
          top.genome,
          input.brainDna.id,
          top.fitness,
          this.now(),
        );
        await input.onCheckpoint(ref, { kind: 'neatGenome', genome: top.genome });
        eliteRefs.push(ref);
      }

      if (bestThisGen.fitness > bestEverFitness) {
        bestEverFitness = bestThisGen.fitness;
        bestEverGenome = bestThisGen.genome;
        bestEverRef = makeNeatCheckpointRef(
          input.runId,
          generation,
          bestEverGenome,
          input.brainDna.id,
          bestEverFitness,
          this.now(),
        );
      }

      emit(run, {
        kind: 'generationFinished',
        runId: input.runId,
        generation,
        aggregateScore: bestThisGen.fitness,
        eliteCheckpointRefs: eliteRefs,
      });

      // Curriculum
      rollingScores.push(bestThisGen.fitness);
      const sc = stage.successCriterion;
      if (rollingScores.length >= sc.window) {
        const window = rollingScores.slice(-sc.window);
        const score = window.reduce((s, v) => s + v, 0) / window.length;
        if (score >= sc.threshold && stageIndex < dna.curriculum.stages.length - 1) {
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

      // Reproduce
      const next: NeatGenome[] = [];
      const offspringPrng = createMulberry32(deriveSeed(dna.seed, generation + 1));
      const allotments = this.allotOffspringSlots(speciesIds, speciesAdjustedSum, totalAdjusted, neat.populationSize);
      for (const [sid, slots] of allotments) {
        const members = [...registry.membersOf(sid)].sort((a, b) => b.fitness - a.fitness);
        if (members.length === 0) continue;
        const eliteCount = Math.min(members.length, Math.max(1, Math.floor(neat.eliteFraction * members.length)));
        for (let i = 0; i < eliteCount && next.length < neat.populationSize; i++) {
          next.push(cloneGenome(members[i]!.genome, 'elite'));
        }
        const remaining = slots - eliteCount;
        for (let i = 0; i < remaining && next.length < neat.populationSize; i++) {
          const child = this.reproduceOne(
            algorithm,
            registry,
            sid,
            members,
            ledger,
            offspringPrng,
            neat,
            generation,
          );
          next.push(child);
        }
      }
      while (next.length < neat.populationSize) {
        const sid = speciesIds[Math.floor(offspringPrng.next() * speciesIds.length)];
        if (sid === undefined) break;
        const members = registry.membersOf(sid);
        if (members.length === 0) continue;
        next.push(cloneGenome(members[0]!.genome, 'fill'));
      }

      population = next;

      registry.pruneStagnant(neat.survival.stagnationCutoffGenerations);
      registry.mergeSmallSpecies(neat.survival.minSpeciesSize);
      registry.adjustThreshold(speciesIds.length);
    }

    await input.onCheckpoint(bestEverRef, { kind: 'neatGenome', genome: bestEverGenome });
    emit(run, {
      kind: 'runFinished',
      runId: input.runId,
      status: run.cancellation.aborted ? 'stopping' : 'completed',
      finishedAt: this.now(),
      bestCheckpointRef: bestEverRef,
    });
    this.active.delete(input.runId);
  }

  private allotOffspringSlots(
    speciesIds: number[],
    speciesAdjustedSum: Map<number, number>,
    totalAdjusted: number,
    populationSize: number,
  ): Map<number, number> {
    const allotments = new Map<number, number>();
    if (totalAdjusted <= 0 || speciesIds.length === 0) {
      const equal = Math.max(1, Math.floor(populationSize / Math.max(1, speciesIds.length)));
      for (const sid of speciesIds) allotments.set(sid, equal);
      return allotments;
    }
    let assigned = 0;
    for (const sid of speciesIds) {
      const fraction = (speciesAdjustedSum.get(sid) ?? 0) / totalAdjusted;
      const slots = Math.max(1, Math.floor(fraction * populationSize));
      allotments.set(sid, slots);
      assigned += slots;
    }
    // top-up the largest species to reach populationSize
    while (assigned < populationSize) {
      let bestSid = speciesIds[0]!;
      let bestVal = -Infinity;
      for (const sid of speciesIds) {
        const v = speciesAdjustedSum.get(sid) ?? 0;
        if (v > bestVal) {
          bestVal = v;
          bestSid = sid;
        }
      }
      allotments.set(bestSid, (allotments.get(bestSid) ?? 0) + 1);
      assigned += 1;
    }
    return allotments;
  }

  private reproduceOne(
    algorithm: 'neat' | 'hyperNeat' | 'neatLstm',
    registry: SpeciesRegistry,
    sid: number,
    members: { genome: NeatGenome; fitness: number }[],
    ledger: InnovationLedger,
    prng: SeededPrng,
    config: NeatTrainingConfig,
    generation: number,
  ): NeatGenome {
    const parentA = members[Math.floor(prng.next() * members.length)]!;
    let parentB: { genome: NeatGenome; fitness: number };
    if (prng.next() < config.crossover.interspeciesProb) {
      const otherIds = registry.speciesIds().filter((id) => id !== sid);
      if (otherIds.length === 0) {
        parentB = members[Math.floor(prng.next() * members.length)]!;
      } else {
        const otherSid = otherIds[Math.floor(prng.next() * otherIds.length)]!;
        const otherMembers = registry.membersOf(otherSid);
        parentB = otherMembers.length > 0 ? otherMembers[Math.floor(prng.next() * otherMembers.length)]! : parentA;
      }
    } else {
      parentB = members[Math.floor(prng.next() * members.length)]!;
    }
    let child = crossover(
      parentA.genome,
      parentB.genome,
      parentA.fitness,
      parentB.fitness,
      config.crossover,
      prng,
    );
    child = mutateWeights(child, config.mutation, prng);
    child = mutateToggleEnabled(child, config.mutation, prng);
    if (prng.next() < config.mutation.addConnectionProb) {
      child = mutateAddConnection(child, ledger, config.mutation, true, prng, generation);
    }
    if (prng.next() < config.mutation.addNodeProb) {
      child = mutateAddNode(child, ledger, config.mutation, prng, generation);
    }
    if (
      algorithm === 'neatLstm' &&
      config.lstm &&
      config.mutation.addLstmNodeProb !== undefined &&
      prng.next() < config.mutation.addLstmNodeProb
    ) {
      child = mutateAddLstmNode(
        child,
        ledger,
        config.mutation,
        config.lstm.gateInitWeightStd,
        prng,
        generation,
      );
    }
    return child;
  }
}
