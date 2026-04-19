import type { IDbClient } from '../../../core/interfaces/IDbClient.js';
import type {
  INeatGenomeRepository,
  NeatGenomeRecord,
  RecordNeatGenomeInput,
} from '../../../application/voxsim/index.js';
import type { ListNeatGenomesFilter, NeatGenome } from '../../../shared/voxsim/index.js';
import { createRecordId } from '../record-id.js';
import { isTableMissing, nowIso, stripIdField } from './mappers.js';

const TABLE = 'voxsim_neat_genome';

interface GenomeRow extends Omit<NeatGenomeRecord, 'id'> {
  id: unknown;
}

function toRecord(row: GenomeRow): NeatGenomeRecord {
  return {
    id: stripIdField(row.id),
    agentId: row.agentId,
    runId: row.runId,
    brainDnaId: row.brainDnaId,
    generation: row.generation,
    speciesId: row.speciesId,
    score: row.score,
    scoreHistory: row.scoreHistory,
    nodeCount: row.nodeCount,
    connectionCount: row.connectionCount,
    enabledConnectionCount: row.enabledConnectionCount,
    lstmNodeCount: row.lstmNodeCount,
    genome: row.genome,
    bytes: row.bytes,
    createdAt: row.createdAt,
  };
}

function summarize(genome: NeatGenome): {
  nodeCount: number;
  connectionCount: number;
  enabledConnectionCount: number;
  lstmNodeCount: number;
  bytes: number;
} {
  const nodes = genome.nodes ?? [];
  const conns = genome.connections ?? [];
  return {
    nodeCount: nodes.length,
    connectionCount: conns.length,
    enabledConnectionCount: conns.filter((c) => c.enabled).length,
    lstmNodeCount: nodes.filter((n) => n.kind === 'lstm').length,
    bytes: JSON.stringify(genome).length,
  };
}

function applyFilter(
  rows: NeatGenomeRecord[],
  filter?: ListNeatGenomesFilter,
): NeatGenomeRecord[] {
  let out = rows;
  if (filter?.agentId) out = out.filter((r) => r.agentId === filter.agentId);
  if (filter?.runId) out = out.filter((r) => r.runId === filter.runId);
  if (filter?.speciesId !== undefined) out = out.filter((r) => r.speciesId === filter.speciesId);
  if (filter?.generation !== undefined) {
    out = out.filter((r) => r.generation === filter.generation);
  }
  if (filter?.minScore !== undefined) {
    const min = filter.minScore;
    out = out.filter((r) => (r.score ?? -Infinity) >= min);
  }
  if (filter?.limit) out = out.slice(0, filter.limit);
  return out;
}

export class SurrealNeatGenomeRepository implements INeatGenomeRepository {
  constructor(private readonly db: IDbClient, private readonly now: () => string = nowIso) {}

  async record(input: RecordNeatGenomeInput): Promise<NeatGenomeRecord> {
    const createdAt = this.now();
    const summary = summarize(input.genome);
    const content: Record<string, unknown> = {
      agentId: input.agentId,
      runId: input.runId,
      brainDnaId: input.brainDnaId,
      generation: input.generation,
      speciesId: input.speciesId,
      score: input.score,
      scoreHistory: input.scoreHistory,
      genome: input.genome,
      ...summary,
      createdAt,
    };
    const surql = input.id
      ? `CREATE type::record($recordId) CONTENT $content RETURN AFTER;`
      : `CREATE ${TABLE} CONTENT $content RETURN AFTER;`;
    const vars: Record<string, unknown> = { content };
    if (input.id) vars.recordId = `${TABLE}:${input.id}`;
    const [rows = []] = await this.db.query<GenomeRow[]>(surql, vars);
    const row = rows[0];
    if (!row) throw new Error('voxsim_neat_genome create failed');
    return toRecord(row);
  }

  async findById(id: string): Promise<NeatGenomeRecord | undefined> {
    try {
      const rows = await this.db.select<GenomeRow>(createRecordId(TABLE, id));
      return rows[0] ? toRecord(rows[0]) : undefined;
    } catch (error) {
      if (isTableMissing(error)) return undefined;
      throw error;
    }
  }

  async list(filter?: ListNeatGenomesFilter): Promise<NeatGenomeRecord[]> {
    try {
      const [rows = []] = await this.db.query<GenomeRow[]>(`SELECT * FROM ${TABLE};`);
      return applyFilter(rows.map(toRecord), filter);
    } catch (error) {
      if (isTableMissing(error)) return [];
      throw error;
    }
  }
}
