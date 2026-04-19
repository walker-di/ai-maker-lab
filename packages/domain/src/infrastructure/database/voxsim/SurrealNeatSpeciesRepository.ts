import type { IDbClient } from '../../../core/interfaces/IDbClient.js';
import type {
  INeatSpeciesRepository,
  NeatSpeciesRecord,
  RecordNeatSpeciesSnapshotInput,
} from '../../../application/voxsim/index.js';
import type { ListNeatSpeciesFilter } from '../../../shared/voxsim/index.js';
import { createRecordId } from '../record-id.js';
import { isTableMissing, nowIso, stripIdField } from './mappers.js';

const TABLE = 'voxsim_neat_species';

interface SpeciesRow extends Omit<NeatSpeciesRecord, 'id'> {
  id: unknown;
}

function toRecord(row: SpeciesRow): NeatSpeciesRecord {
  return {
    id: stripIdField(row.id),
    runId: row.runId,
    speciesId: row.speciesId,
    latestGeneration: row.latestGeneration,
    latestSize: row.latestSize,
    latestBestScore: row.latestBestScore,
    latestMeanScore: row.latestMeanScore,
    latestStagnationGenerations: row.latestStagnationGenerations,
    representativeGenomeId: row.representativeGenomeId,
    generationHistory: row.generationHistory,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function compositeId(runId: string, speciesId: number): string {
  return `${runId}__${speciesId}`;
}

export class SurrealNeatSpeciesRepository implements INeatSpeciesRepository {
  constructor(private readonly db: IDbClient, private readonly now: () => string = nowIso) {}

  async recordSnapshot(input: RecordNeatSpeciesSnapshotInput): Promise<NeatSpeciesRecord> {
    const id = compositeId(input.runId, input.speciesId);
    const existing = await this.findOne(id);
    const now = this.now();
    const entry = {
      generation: input.generation,
      size: input.size,
      bestScore: input.bestScore,
      meanScore: input.meanScore,
      stagnation: input.stagnationGenerations,
      representativeGenomeId: input.representativeGenomeId,
    };
    if (existing) {
      const merged: NeatSpeciesRecord = {
        ...existing,
        latestGeneration: input.generation,
        latestSize: input.size,
        latestBestScore: input.bestScore,
        latestMeanScore: input.meanScore,
        latestStagnationGenerations: input.stagnationGenerations,
        representativeGenomeId: input.representativeGenomeId,
        generationHistory: [...existing.generationHistory, entry],
        updatedAt: now,
      };
      const rows = await this.db.update<SpeciesRow, Omit<SpeciesRow, 'id'>>(
        createRecordId(TABLE, id),
        {
          runId: merged.runId,
          speciesId: merged.speciesId,
          latestGeneration: merged.latestGeneration,
          latestSize: merged.latestSize,
          latestBestScore: merged.latestBestScore,
          latestMeanScore: merged.latestMeanScore,
          latestStagnationGenerations: merged.latestStagnationGenerations,
          representativeGenomeId: merged.representativeGenomeId,
          generationHistory: merged.generationHistory,
          createdAt: merged.createdAt,
          updatedAt: merged.updatedAt,
        },
      );
      const row = rows[0];
      if (!row) throw new Error('voxsim_neat_species update failed');
      return toRecord(row);
    }
    const rows = await this.db.create<SpeciesRow, Omit<SpeciesRow, 'id'>>(
      createRecordId(TABLE, id),
      {
        runId: input.runId,
        speciesId: input.speciesId,
        latestGeneration: input.generation,
        latestSize: input.size,
        latestBestScore: input.bestScore,
        latestMeanScore: input.meanScore,
        latestStagnationGenerations: input.stagnationGenerations,
        representativeGenomeId: input.representativeGenomeId,
        generationHistory: [entry],
        createdAt: now,
        updatedAt: now,
      },
    );
    const row = rows[0];
    if (!row) throw new Error('voxsim_neat_species create failed');
    return toRecord(row);
  }

  async list(filter: ListNeatSpeciesFilter): Promise<NeatSpeciesRecord[]> {
    try {
      const [rows = []] = await this.db.query<SpeciesRow[]>(`SELECT * FROM ${TABLE};`);
      let out = rows.map(toRecord).filter((r) => r.runId === filter.runId);
      if (filter.generation !== undefined) {
        out = out.filter((r) => r.latestGeneration >= (filter.generation ?? 0));
      }
      if (filter.limit) out = out.slice(0, filter.limit);
      return out;
    } catch (error) {
      if (isTableMissing(error)) return [];
      throw error;
    }
  }

  private async findOne(id: string): Promise<NeatSpeciesRecord | undefined> {
    try {
      const rows = await this.db.select<SpeciesRow>(createRecordId(TABLE, id));
      return rows[0] ? toRecord(rows[0]) : undefined;
    } catch (error) {
      if (isTableMissing(error)) return undefined;
      throw error;
    }
  }
}
