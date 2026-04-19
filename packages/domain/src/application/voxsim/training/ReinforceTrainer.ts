/**
 * `ReinforceTrainer` is reserved for a follow-up cut. The orchestrator can
 * accept the stub today; a future change replaces this with a real vanilla
 * policy-gradient implementation that delegates gradient compute to a worker.
 */

import type { TrainingAlgorithm } from '../../../shared/voxsim/index.js';
import type {
  ITrainer,
  TrainerStartInput,
  TrainingProgressListener,
  TrainingRunHandle,
  Unsubscribe,
} from './ITrainer.js';

export class ReinforceTrainer implements ITrainer {
  readonly id = 'reinforce-trainer';
  readonly kind: TrainingAlgorithm = 'reinforce';

  async start(_input: TrainerStartInput): Promise<TrainingRunHandle> {
    throw new Error(
      "ReinforceTrainer is not implemented in v1. Use 'evolution' or one of the NEAT-family algorithms.",
    );
  }

  async pause(_handle: TrainingRunHandle): Promise<void> {
    throw new Error('ReinforceTrainer is not implemented in v1.');
  }

  async resume(_handle: TrainingRunHandle): Promise<void> {
    throw new Error('ReinforceTrainer is not implemented in v1.');
  }

  async stop(_handle: TrainingRunHandle): Promise<void> {
    throw new Error('ReinforceTrainer is not implemented in v1.');
  }

  subscribe(_handle: TrainingRunHandle, _listener: TrainingProgressListener): Unsubscribe {
    throw new Error('ReinforceTrainer is not implemented in v1.');
  }
}
