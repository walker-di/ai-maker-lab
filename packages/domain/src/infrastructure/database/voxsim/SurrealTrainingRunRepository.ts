import type { IDbClient } from '../../../core/interfaces/IDbClient.js';
import type {
  CreateTrainingRunInput,
  ITrainingRunRepository,
  TrainingRunRecord,
  UpdateTrainingRunFields,
} from '../../../application/voxsim/index.js';
import type { ListRunsFilter, TrainingRunStatus } from '../../../shared/voxsim/index.js';
import { createRecordId } from '../record-id.js';
import { isTableMissing, nowIso, stripIdField } from './mappers.js';

const TABLE = 'voxsim_training_run';

interface RunRow extends Omit<TrainingRunRecord, 'id'> {
  id: unknown;
}

function toRecord(row: RunRow): TrainingRunRecord {
  return {
    id: stripIdField(row.id),
    agentId: row.agentId,
    trainingDnaSnapshot: row.trainingDnaSnapshot,
    algorithm: row.algorithm,
    arenaCurriculumIds: row.arenaCurriculumIds,
    status: row.status,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    bestCheckpointRef: row.bestCheckpointRef,
    bestScore: row.bestScore,
    totalEpisodes: row.totalEpisodes,
    totalGenerations: row.totalGenerations,
    currentSpeciesCount: row.currentSpeciesCount,
    totalSpeciesEverSeen: row.totalSpeciesEverSeen,
    innovationLedgerSnapshot: row.innovationLedgerSnapshot,
  };
}

function applyFilter(rows: TrainingRunRecord[], filter?: ListRunsFilter): TrainingRunRecord[] {
  let out = rows;
  if (filter?.agentId) out = out.filter((r) => r.agentId === filter.agentId);
  if (filter?.status) out = out.filter((r) => r.status === filter.status);
  if (filter?.since) out = out.filter((r) => r.startedAt >= filter.since!);
  if (filter?.limit) out = out.slice(0, filter.limit);
  return out;
}

export class SurrealTrainingRunRepository implements ITrainingRunRepository {
  constructor(private readonly db: IDbClient, private readonly now: () => string = nowIso) {}

  async list(filter?: ListRunsFilter): Promise<TrainingRunRecord[]> {
    try {
      const [rows = []] = await this.db.query<RunRow[]>(`SELECT * FROM ${TABLE};`);
      return applyFilter(rows.map(toRecord), filter);
    } catch (error) {
      if (isTableMissing(error)) return [];
      throw error;
    }
  }

  async findById(id: string): Promise<TrainingRunRecord | undefined> {
    try {
      const rows = await this.db.select<RunRow>(createRecordId(TABLE, id));
      return rows[0] ? toRecord(rows[0]) : undefined;
    } catch (error) {
      if (isTableMissing(error)) return undefined;
      throw error;
    }
  }

  async create(input: CreateTrainingRunInput): Promise<TrainingRunRecord> {
    const [rows = []] = await this.db.query<RunRow[]>(
      `CREATE ${TABLE} CONTENT $content RETURN AFTER;`,
      {
        content: {
          agentId: input.agentId,
          trainingDnaSnapshot: input.trainingDnaSnapshot,
          algorithm: input.algorithm,
          arenaCurriculumIds: input.arenaCurriculumIds,
          status: input.status,
          startedAt: input.startedAt,
          totalEpisodes: 0,
          totalGenerations: 0,
        },
      },
    );
    const row = rows[0];
    if (!row) throw new Error('voxsim_training_run create failed');
    return toRecord(row);
  }

  async updateStatus(
    id: string,
    status: TrainingRunStatus,
    fields?: UpdateTrainingRunFields,
  ): Promise<TrainingRunRecord> {
    const existing = await this.findById(id);
    if (!existing) throw new Error(`voxsim_training_run ${id} not found`);
    const merged: TrainingRunRecord = {
      ...existing,
      status,
      bestCheckpointRef: fields?.bestCheckpointRef ?? existing.bestCheckpointRef,
      bestScore: fields?.bestScore ?? existing.bestScore,
      totalEpisodes: fields?.totalEpisodes ?? existing.totalEpisodes,
      totalGenerations: fields?.totalGenerations ?? existing.totalGenerations,
      currentSpeciesCount: fields?.currentSpeciesCount ?? existing.currentSpeciesCount,
      totalSpeciesEverSeen: fields?.totalSpeciesEverSeen ?? existing.totalSpeciesEverSeen,
      finishedAt: fields?.finishedAt ?? existing.finishedAt,
      innovationLedgerSnapshot:
        fields?.innovationLedgerSnapshot ?? existing.innovationLedgerSnapshot,
    };
    const rows = await this.db.update<RunRow, Omit<RunRow, 'id'>>(createRecordId(TABLE, id), {
      agentId: merged.agentId,
      trainingDnaSnapshot: merged.trainingDnaSnapshot,
      algorithm: merged.algorithm,
      arenaCurriculumIds: merged.arenaCurriculumIds,
      status: merged.status,
      startedAt: merged.startedAt,
      finishedAt: merged.finishedAt,
      bestCheckpointRef: merged.bestCheckpointRef,
      bestScore: merged.bestScore,
      totalEpisodes: merged.totalEpisodes,
      totalGenerations: merged.totalGenerations,
      currentSpeciesCount: merged.currentSpeciesCount,
      totalSpeciesEverSeen: merged.totalSpeciesEverSeen,
      innovationLedgerSnapshot: merged.innovationLedgerSnapshot,
    });
    return toRecord(rows[0] ?? ({ ...merged, id } as RunRow));
  }
}
