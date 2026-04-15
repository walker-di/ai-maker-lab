import type { IDbClient } from '../../../core/interfaces/IDbClient.js';
import type { ChatMessage, CreateMessageInput, AttachmentRef } from '../../../shared/chat/index.js';
import type { IChatMessageRepository } from '../../../application/chat/ports.js';
import { createRecordId } from '../record-id.js';

const TABLE = 'chat_message';

type MessageRecord = {
  id: string;
  threadId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  parentMessageId?: string;
  agentId?: string;
  chatRunId?: string;
  attachments: AttachmentRef[];
  createdAt: string;
};

function toMessage(record: MessageRecord): ChatMessage {
  return {
    id: record.id,
    threadId: record.threadId,
    role: record.role,
    content: record.content,
    parentMessageId: record.parentMessageId ?? undefined,
    agentId: record.agentId ?? undefined,
    chatRunId: record.chatRunId ?? undefined,
    attachments: record.attachments ?? [],
    createdAt: record.createdAt,
  };
}

export class SurrealChatMessageRepository implements IChatMessageRepository {
  constructor(private readonly db: IDbClient) {}

  async listByThread(threadId: string): Promise<ChatMessage[]> {
    try {
      const [records = []] = await this.db.query<MessageRecord[]>(
        `SELECT * FROM ${TABLE} WHERE threadId = $threadId ORDER BY createdAt ASC;`,
        { threadId },
      );
      return records.map(toMessage);
    } catch {
      return [];
    }
  }

  async findById(id: string): Promise<ChatMessage | null> {
    try {
      const records = await this.db.select<MessageRecord>(createRecordId(TABLE, id));
      const record = records[0];
      return record ? toMessage(record) : null;
    } catch {
      return null;
    }
  }

  async create(input: CreateMessageInput): Promise<ChatMessage> {
    const [records = []] = await this.db.query<MessageRecord[]>(
      `CREATE ${TABLE} CONTENT {
        threadId: $threadId,
        role: $role,
        content: $content,
        parentMessageId: $parentMessageId,
        agentId: $agentId,
        attachments: $attachments,
        createdAt: $createdAt
      };`,
      {
        threadId: input.threadId,
        role: input.role,
        content: input.content,
        parentMessageId: input.parentMessageId ?? null,
        agentId: input.agentId ?? null,
        attachments: input.attachments ?? [],
        createdAt: new Date().toISOString(),
      },
    );

    if (!records[0]) throw new Error('Message create failed.');
    return toMessage(records[0]);
  }

  async listReplies(parentMessageId: string): Promise<ChatMessage[]> {
    try {
      const [records = []] = await this.db.query<MessageRecord[]>(
        `SELECT * FROM ${TABLE} WHERE parentMessageId = $parentMessageId ORDER BY createdAt ASC;`,
        { parentMessageId },
      );
      return records.map(toMessage);
    } catch {
      return [];
    }
  }
}
