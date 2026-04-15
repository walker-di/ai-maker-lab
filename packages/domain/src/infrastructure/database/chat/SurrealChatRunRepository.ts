import type { IDbClient } from '../../../core/interfaces/IDbClient.js';
import type { ChatRun } from '../../../shared/chat/index.js';
import type { IChatRunRepository } from '../../../application/chat/ports.js';
import { createRecordId } from '../record-id.js';

const TABLE = 'chat_run';

type RunRecord = {
  id: string;
  threadId: string;
  messageId: string;
  agentId: string;
  modelSnapshot: { registryId: string; label: string };
  status: 'streaming' | 'completed' | 'failed' | 'cancelled';
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
  finishReason?: string;
  startedAt: string;
  completedAt?: string;
};

function toRun(record: RunRecord): ChatRun {
  return {
    id: record.id,
    threadId: record.threadId,
    messageId: record.messageId,
    agentId: record.agentId,
    modelSnapshot: record.modelSnapshot,
    status: record.status,
    usage: record.usage ?? undefined,
    finishReason: record.finishReason ?? undefined,
    startedAt: record.startedAt,
    completedAt: record.completedAt ?? undefined,
  };
}

export class SurrealChatRunRepository implements IChatRunRepository {
  constructor(private readonly db: IDbClient) {}

  async create(run: Omit<ChatRun, 'id'>): Promise<ChatRun> {
    const [records = []] = await this.db.query<RunRecord[]>(
      `CREATE ${TABLE} CONTENT {
        threadId: $threadId,
        messageId: $messageId,
        agentId: $agentId,
        modelSnapshot: $modelSnapshot,
        status: $status,
        usage: $usage,
        finishReason: $finishReason,
        startedAt: $startedAt,
        completedAt: $completedAt
      };`,
      {
        threadId: run.threadId,
        messageId: run.messageId,
        agentId: run.agentId,
        modelSnapshot: run.modelSnapshot,
        status: run.status,
        usage: run.usage ?? null,
        finishReason: run.finishReason ?? null,
        startedAt: run.startedAt,
        completedAt: run.completedAt ?? null,
      },
    );

    if (!records[0]) throw new Error('Chat run create failed.');
    return toRun(records[0]);
  }

  async update(run: ChatRun): Promise<ChatRun> {
    const records = await this.db.update<RunRecord, Record<string, unknown>>(
      createRecordId(TABLE, run.id),
      {
        threadId: run.threadId,
        messageId: run.messageId,
        agentId: run.agentId,
        modelSnapshot: run.modelSnapshot,
        status: run.status,
        usage: run.usage ?? null,
        finishReason: run.finishReason ?? null,
        startedAt: run.startedAt,
        completedAt: run.completedAt ?? null,
      },
    );

    return toRun(records[0] ?? run);
  }

  async findById(id: string): Promise<ChatRun | null> {
    try {
      const records = await this.db.select<RunRecord>(createRecordId(TABLE, id));
      const record = records[0];
      return record ? toRun(record) : null;
    } catch {
      return null;
    }
  }

  async findByMessage(messageId: string): Promise<ChatRun | null> {
    try {
      const [records = []] = await this.db.query<RunRecord[]>(
        `SELECT * FROM ${TABLE} WHERE messageId = $messageId LIMIT 1;`,
        { messageId },
      );
      const record = records[0];
      return record ? toRun(record) : null;
    } catch {
      return null;
    }
  }
}
