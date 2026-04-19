/**
 * `TrainerOrchestrator` is the single entry point used by the application
 * layer. It owns the trainer registry and delegates to the right `ITrainer`
 * based on `TrainingDna.algorithm`.
 *
 * In v1 the orchestrator is a thin dispatcher; trainer implementations
 * already own worker scheduling, curriculum, and progress emission. A future
 * cut can move shared scheduling here once we have multiple gradient-method
 * trainers competing for the same worker pool.
 */

import type { TrainingAlgorithm } from '../../../shared/voxsim/index.js';
import { EvolutionTrainer } from './EvolutionTrainer.js';
import { NeatTrainer } from './neat/NeatTrainer.js';
import { PpoLiteTrainer } from './PpoLiteTrainer.js';
import { ReinforceTrainer } from './ReinforceTrainer.js';
import type {
  ITrainer,
  TrainerStartInput,
  TrainingProgressListener,
  TrainingRunHandle,
  Unsubscribe,
} from './ITrainer.js';
import type { WorkerHostFactory } from './worker-host.js';

export interface TrainerOrchestratorOptions {
  workerHostFactory: WorkerHostFactory;
  /** Optional override for trainer construction (used by tests). */
  trainerOverrides?: Partial<Record<TrainingAlgorithm, ITrainer>>;
  now?: () => string;
}

export class TrainerOrchestrator {
  private readonly trainers: Map<TrainingAlgorithm, ITrainer>;
  private readonly handleToTrainer = new Map<string, ITrainer>();

  constructor(options: TrainerOrchestratorOptions) {
    const evolution = new EvolutionTrainer({
      workerHostFactory: options.workerHostFactory,
      now: options.now,
    });
    const neat = new NeatTrainer({
      workerHostFactory: options.workerHostFactory,
      now: options.now,
    });
    const reinforce = new ReinforceTrainer();
    const ppoLite = new PpoLiteTrainer();

    this.trainers = new Map<TrainingAlgorithm, ITrainer>([
      ['evolution', evolution],
      ['reinforce', reinforce],
      ['ppoLite', ppoLite],
      ['neat', neat],
      ['hyperNeat', neat],
      ['neatLstm', neat],
    ]);

    if (options.trainerOverrides) {
      for (const [k, v] of Object.entries(options.trainerOverrides)) {
        if (v) this.trainers.set(k as TrainingAlgorithm, v);
      }
    }
  }

  async start(input: TrainerStartInput): Promise<TrainingRunHandle> {
    const trainer = this.trainerFor(input.trainingDna.algorithm);
    const handle = await trainer.start(input);
    this.handleToTrainer.set(handle.runId, trainer);
    return handle;
  }

  async pause(handle: TrainingRunHandle): Promise<void> {
    await this.requireTrainer(handle).pause(handle);
  }

  async resume(handle: TrainingRunHandle): Promise<void> {
    await this.requireTrainer(handle).resume(handle);
  }

  async stop(handle: TrainingRunHandle): Promise<void> {
    const trainer = this.requireTrainer(handle);
    await trainer.stop(handle);
    this.handleToTrainer.delete(handle.runId);
  }

  subscribe(handle: TrainingRunHandle, listener: TrainingProgressListener): Unsubscribe {
    return this.requireTrainer(handle).subscribe(handle, listener);
  }

  private trainerFor(algorithm: TrainingAlgorithm): ITrainer {
    const t = this.trainers.get(algorithm);
    if (!t) throw new Error(`no trainer registered for algorithm '${algorithm}'`);
    return t;
  }

  private requireTrainer(handle: TrainingRunHandle): ITrainer {
    const t = this.handleToTrainer.get(handle.runId);
    if (!t) throw new Error(`unknown run '${handle.runId}'`);
    return t;
  }
}
