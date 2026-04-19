/**
 * Checkpoint and replay use cases (v1).
 */

import type { ListCheckpointsFilter } from '../../../shared/voxsim/index.js';
import type {
  IReplayRepository,
  IWeightCheckpointRepository,
  RecordReplayInput,
  RecordWeightCheckpointInput,
  ReplayRecord,
  WeightCheckpointRecord,
} from '../ports.js';

export class SaveWeightCheckpoint {
  constructor(private readonly checkpoints: IWeightCheckpointRepository) {}
  async execute(input: RecordWeightCheckpointInput): Promise<WeightCheckpointRecord> {
    return this.checkpoints.record(input);
  }
}

export class LoadWeightCheckpoint {
  constructor(private readonly checkpoints: IWeightCheckpointRepository) {}
  async execute(id: string): Promise<WeightCheckpointRecord | undefined> {
    return this.checkpoints.findById(id);
  }
}

export class ListCheckpoints {
  constructor(private readonly checkpoints: IWeightCheckpointRepository) {}
  async execute(filter?: ListCheckpointsFilter): Promise<WeightCheckpointRecord[]> {
    return this.checkpoints.list(filter);
  }
}

export class RecordReplay {
  constructor(private readonly replays: IReplayRepository) {}
  async execute(input: RecordReplayInput): Promise<ReplayRecord> {
    return this.replays.record(input);
  }
}

export class LoadReplay {
  constructor(private readonly replays: IReplayRepository) {}
  async execute(id: string): Promise<ReplayRecord | undefined> {
    return this.replays.findById(id);
  }
}
