/**
 * NEAT-specific use cases (v1). Consumed by the lab page when the selected
 * run uses a NEAT algorithm and by the training coordinator internals.
 */

import type {
  ListNeatGenomesFilter,
  ListNeatInnovationsFilter,
  ListNeatSpeciesFilter,
} from '../../../shared/voxsim/index.js';
import type {
  INeatGenomeRepository,
  INeatInnovationLogRepository,
  INeatSpeciesRepository,
  NeatGenomeRecord,
  NeatInnovationLogRecord,
  NeatSpeciesRecord,
  RecordNeatGenomeInput,
  RecordNeatInnovationLogInput,
  RecordNeatSpeciesSnapshotInput,
} from '../ports.js';

export class RecordNeatGenome {
  constructor(private readonly genomes: INeatGenomeRepository) {}
  async execute(input: RecordNeatGenomeInput): Promise<NeatGenomeRecord> {
    return this.genomes.record(input);
  }
}

export class LoadNeatGenome {
  constructor(private readonly genomes: INeatGenomeRepository) {}
  async execute(id: string): Promise<NeatGenomeRecord | undefined> {
    return this.genomes.findById(id);
  }
}

export class ListNeatGenomes {
  constructor(private readonly genomes: INeatGenomeRepository) {}
  async execute(filter?: ListNeatGenomesFilter): Promise<NeatGenomeRecord[]> {
    return this.genomes.list(filter);
  }
}

export class RecordNeatSpeciesSnapshot {
  constructor(private readonly species: INeatSpeciesRepository) {}
  async execute(input: RecordNeatSpeciesSnapshotInput): Promise<NeatSpeciesRecord> {
    return this.species.recordSnapshot(input);
  }
}

export class ListNeatSpecies {
  constructor(private readonly species: INeatSpeciesRepository) {}
  async execute(filter: ListNeatSpeciesFilter): Promise<NeatSpeciesRecord[]> {
    return this.species.list(filter);
  }
}

export class RecordNeatInnovationLog {
  constructor(private readonly innovations: INeatInnovationLogRepository) {}
  async execute(input: RecordNeatInnovationLogInput): Promise<NeatInnovationLogRecord> {
    return this.innovations.record(input);
  }
}

export class ListNeatInnovationLog {
  constructor(private readonly innovations: INeatInnovationLogRepository) {}
  async execute(filter: ListNeatInnovationsFilter): Promise<NeatInnovationLogRecord[]> {
    return this.innovations.list(filter);
  }
}
