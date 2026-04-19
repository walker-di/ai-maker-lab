/**
 * `InProcessWorkerHost` runs the worker pipeline synchronously inside the
 * caller's process. The orchestrator sees an identical contract whether the
 * underlying host is a Bun worker or this in-process fake. Used by every
 * application-layer test in this folder and as the default v1 host until the
 * Bun worker entrypoint lands in `infrastructure/voxsim/training`.
 */

import type {
  TrainingWorkerEvaluate,
  TrainingWorkerEvaluateResult,
  TrainingWorkerInit,
  WorkerHost,
  WorkerHostFactory,
} from './worker-host.js';

export type InProcessEvaluator = (
  input: TrainingWorkerEvaluate,
  init: TrainingWorkerInit,
) => Promise<TrainingWorkerEvaluateResult>;

export interface InProcessWorkerHostOptions {
  evaluator: InProcessEvaluator;
}

export class InProcessWorkerHost implements WorkerHost {
  private initInput: TrainingWorkerInit | null = null;
  private disposed = false;

  constructor(private readonly options: InProcessWorkerHostOptions) {}

  async init(input: TrainingWorkerInit): Promise<void> {
    if (this.disposed) throw new Error('InProcessWorkerHost is disposed');
    this.initInput = input;
  }

  async evaluate(input: TrainingWorkerEvaluate): Promise<TrainingWorkerEvaluateResult> {
    if (this.disposed) throw new Error('InProcessWorkerHost is disposed');
    if (!this.initInput) throw new Error('InProcessWorkerHost.init has not been called');
    return await this.options.evaluator(input, this.initInput);
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    this.initInput = null;
  }
}

export class InProcessWorkerHostFactory implements WorkerHostFactory {
  constructor(private readonly options: InProcessWorkerHostOptions) {}

  create(): WorkerHost {
    return new InProcessWorkerHost(this.options);
  }
}
