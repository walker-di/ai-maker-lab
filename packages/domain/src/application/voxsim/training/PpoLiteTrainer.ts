/**
 * `PpoLiteTrainer` is reserved for a follow-up cut. The orchestrator can
 * accept the stub today; a future change replaces this with a clipped
 * surrogate optimizer that delegates gradient compute to a worker.
 */

import type { TrainingAlgorithm } from '../../../shared/voxsim/index.js';
import type {
  ITrainer,
  TrainerStartInput,
  TrainingProgressListener,
  TrainingRunHandle,
  Unsubscribe,
} from './ITrainer.js';

export class PpoLiteTrainer implements ITrainer {
  readonly id = 'ppo-lite-trainer';
  readonly kind: TrainingAlgorithm = 'ppoLite';

  async start(_input: TrainerStartInput): Promise<TrainingRunHandle> {
    throw new Error(
      "PpoLiteTrainer is not implemented in v1. Use 'evolution' or one of the NEAT-family algorithms.",
    );
  }

  async pause(_handle: TrainingRunHandle): Promise<void> {
    throw new Error('PpoLiteTrainer is not implemented in v1.');
  }

  async resume(_handle: TrainingRunHandle): Promise<void> {
    throw new Error('PpoLiteTrainer is not implemented in v1.');
  }

  async stop(_handle: TrainingRunHandle): Promise<void> {
    throw new Error('PpoLiteTrainer is not implemented in v1.');
  }

  subscribe(_handle: TrainingRunHandle, _listener: TrainingProgressListener): Unsubscribe {
    throw new Error('PpoLiteTrainer is not implemented in v1.');
  }
}
