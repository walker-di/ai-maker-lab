import type { IDbClient } from '../../../core/interfaces/IDbClient.js';
import type { AttachmentRef } from '../../../shared/chat/index.js';
import type { IAttachmentRepository } from '../../../application/chat/ports.js';
import { createRecordId } from '../record-id.js';

const TABLE = 'attachment';

type AttachmentRecord = {
  id: string;
  messageId: string;
  type: 'image' | 'file' | 'pdf' | 'video' | 'text';
  name: string;
  mimeType: string;
  url?: string;
  content?: string;
};

function toAttachment(record: AttachmentRecord): AttachmentRef {
  return {
    id: record.id,
    messageId: record.messageId,
    type: record.type,
    name: record.name,
    mimeType: record.mimeType,
    url: record.url ?? undefined,
    content: record.content ?? undefined,
  };
}

export class SurrealAttachmentRepository implements IAttachmentRepository {
  constructor(private readonly db: IDbClient) {}

  async create(attachment: Omit<AttachmentRef, 'id'>): Promise<AttachmentRef> {
    const [records = []] = await this.db.query<AttachmentRecord[]>(
      `CREATE ${TABLE} CONTENT {
        messageId: $messageId,
        type: $type,
        name: $name,
        mimeType: $mimeType,
        url: $url,
        content: $content
      };`,
      {
        messageId: attachment.messageId,
        type: attachment.type,
        name: attachment.name,
        mimeType: attachment.mimeType,
        url: attachment.url ?? null,
        content: attachment.content ?? null,
      },
    );

    if (!records[0]) throw new Error('Attachment create failed.');
    return toAttachment(records[0]);
  }

  async listByMessage(messageId: string): Promise<AttachmentRef[]> {
    const [records = []] = await this.db.query<AttachmentRecord[]>(
      `SELECT * FROM ${TABLE} WHERE messageId = $messageId;`,
      { messageId },
    );
    return records.map(toAttachment);
  }
}
