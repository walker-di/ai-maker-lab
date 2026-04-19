import type { IDbClient } from '../../../core/interfaces/IDbClient.js';
import type { ChatThread, CreateThreadInput } from '../../../shared/chat/index.js';
import type { IChatThreadRepository } from '../../../application/chat/ports.js';
import { createRecordId } from '../record-id.js';

const TABLE = 'chat_thread';

type ThreadRecord = {
  id: string;
  title: string;
  participantIds: string[];
  defaultAgentId?: string;
  createdAt: string;
  updatedAt: string;
};

function toThread(record: ThreadRecord): ChatThread {
  return {
    id: record.id,
    title: record.title,
    participantIds: record.participantIds ?? [],
    defaultAgentId: record.defaultAgentId ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export class SurrealChatThreadRepository implements IChatThreadRepository {
  constructor(private readonly db: IDbClient) {}

  async list(): Promise<ChatThread[]> {
    try {
      const [records = []] = await this.db.query<ThreadRecord[]>(
        `SELECT * FROM ${TABLE} ORDER BY updatedAt DESC;`,
      );
      return records.map(toThread);
    } catch {
      return [];
    }
  }

  async findById(id: string): Promise<ChatThread | null> {
    try {
      const records = await this.db.select<ThreadRecord>(createRecordId(TABLE, id));
      const record = records[0];
      return record ? toThread(record) : null;
    } catch {
      return null;
    }
  }

  async create(input: CreateThreadInput): Promise<ChatThread> {
    const now = new Date().toISOString();
    const [records = []] = await this.db.query<ThreadRecord[]>(
      `CREATE ${TABLE} CONTENT {
        title: $title,
        participantIds: $participantIds,
        defaultAgentId: $defaultAgentId,
        createdAt: $createdAt,
        updatedAt: $updatedAt
      };`,
      {
        title: input.title,
        participantIds: [...input.participantIds],
        defaultAgentId: input.defaultAgentId ?? null,
        createdAt: now,
        updatedAt: now,
      },
    );

    if (!records[0]) throw new Error('Thread create failed.');
    return toThread(records[0]);
  }

  async update(thread: ChatThread): Promise<ChatThread> {
    const now = new Date().toISOString();
    const records = await this.db.update<ThreadRecord, Record<string, unknown>>(
      createRecordId(TABLE, thread.id),
      {
        title: thread.title,
        participantIds: [...thread.participantIds],
        defaultAgentId: thread.defaultAgentId ?? null,
        createdAt: thread.createdAt,
        updatedAt: now,
      },
    );

    return toThread(records[0] ?? thread);
  }

  async remove(id: string): Promise<void> {
    await this.db.delete<ThreadRecord>(createRecordId(TABLE, id));
  }
}
