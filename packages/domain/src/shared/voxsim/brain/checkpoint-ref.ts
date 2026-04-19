/**
 * Cross-table pointer to either a flat-weight checkpoint or a NEAT genome
 * row. Plan 07 stores these as separate tables; consumers (episodes,
 * training runs, the inspector) keep `CheckpointRef` as the canonical
 * pointer.
 */

export interface WeightCheckpointRef {
  id: string;
  brainDnaId: string;
  bytes: number;
  score?: number;
  generation?: number;
  createdAt: string;
}

export type CheckpointRef =
  | { kind: 'flat'; ref: WeightCheckpointRef }
  | {
      kind: 'neatGenome';
      genomeId: string;
      brainDnaId: string;
      generation: number;
      bytes: number;
      score?: number;
      createdAt: string;
    };

export type CheckpointKind = CheckpointRef['kind'];
