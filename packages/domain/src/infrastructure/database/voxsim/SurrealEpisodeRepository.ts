import type { IDbClient } from '../../../core/interfaces/IDbClient.js';
import type {
  EpisodeRecord,
  IEpisodeRepository,
  RecordEpisodeInput,
} from '../../../application/voxsim/index.js';
import type { ListEpisodesFilter } from '../../../shared/voxsim/index.js';
import { isTableMissing, nowIso, stripIdField } from './mappers.js';

const TABLE = 'voxsim_episode';

interface EpisodeRow extends Omit<EpisodeRecord, 'id'> {
  id: unknown;
}

function toRecord(row: EpisodeRow): EpisodeRecord {
  return {
    id: stripIdField(row.id),
    runId: row.runId,
    agentId: row.agentId,
    bodyDnaId: row.bodyDnaId,
    brainDnaId: row.brainDnaId,
    checkpointRef: row.checkpointRef,
    arenaId: row.arenaId,
    generation: row.generation,
    candidateIndex: row.candidateIndex,
    speciesId: row.speciesId,
    seed: row.seed,
    outcome: row.outcome,
    totalReward: row.totalReward,
    meanReward: row.meanReward,
    steps: row.steps,
    replayRef: row.replayRef,
    metricBreakdown: row.metricBreakdown,
    createdAt: row.createdAt,
  };
}

function applyFilter(rows: EpisodeRecord[], filter?: ListEpisodesFilter): EpisodeRecord[] {
  let out = rows;
  if (filter?.runId) out = out.filter((r) => r.runId === filter.runId);
  if (filter?.agentId) out = out.filter((r) => r.agentId === filter.agentId);
  if (filter?.arenaId) out = out.filter((r) => r.arenaId === filter.arenaId);
  if (filter?.outcome) out = out.filter((r) => r.outcome.kind === filter.outcome);
  if (filter?.since) out = out.filter((r) => r.createdAt >= filter.since!);
  if (filter?.limit) out = out.slice(0, filter.limit);
  return out;
}

export class SurrealEpisodeRepository implements IEpisodeRepository {
  constructor(private readonly db: IDbClient, private readonly now: () => string = nowIso) {}

  async list(filter?: ListEpisodesFilter): Promise<EpisodeRecord[]> {
    try {
      const [rows = []] = await this.db.query<EpisodeRow[]>(`SELECT * FROM ${TABLE};`);
      return applyFilter(rows.map(toRecord), filter);
    } catch (error) {
      if (isTableMissing(error)) return [];
      throw error;
    }
  }

  async record(input: RecordEpisodeInput): Promise<EpisodeRecord> {
    const createdAt = this.now();
    const [rows = []] = await this.db.query<EpisodeRow[]>(
      `CREATE ${TABLE} CONTENT $content RETURN AFTER;`,
      {
        content: {
          runId: input.runId,
          agentId: input.agentId,
          bodyDnaId: input.bodyDnaId,
          brainDnaId: input.brainDnaId,
          checkpointRef: input.checkpointRef,
          arenaId: input.arenaId,
          generation: input.generation,
          candidateIndex: input.candidateIndex,
          speciesId: input.speciesId,
          seed: input.seed,
          outcome: input.outcome,
          totalReward: input.totalReward,
          meanReward: input.meanReward,
          steps: input.steps,
          replayRef: input.replayRef,
          metricBreakdown: input.metricBreakdown,
          createdAt,
        },
      },
    );
    const row = rows[0];
    if (!row) throw new Error('voxsim_episode create failed');
    return toRecord(row);
  }
}
