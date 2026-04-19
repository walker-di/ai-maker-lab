import type { IDbClient } from '../../../core/interfaces/IDbClient.js';
import type { AttachmentRef, AttachmentClassification, AttachmentStatus } from '../../../shared/chat/index.js';
import type { IAttachmentRepository } from '../../../application/chat/ports.js';
import { createRecordId } from '../record-id.js';

const TABLE = 'attachment';

type AttachmentRecord = {
  id: string;
  messageId: string;
  type: AttachmentClassification;
  name: string;
  mimeType: string;
  path?: string;
  inlineDataBase64?: string;
  size: number;
  lastModified: string;
  status: AttachmentStatus;
};

function toAttachment(record: AttachmentRecord): AttachmentRef {
  return {
    id: record.id,
    messageId: record.messageId,
    type: record.type,
    name: record.name,
    mimeType: record.mimeType,
    path: record.path ?? undefined,
    inlineDataBase64: record.inlineDataBase64 ?? undefined,
    size: record.size ?? 0,
    lastModified: record.lastModified ?? '',
    status: record.status ?? 'pending',
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
        path: $path,
        inlineDataBase64: $inlineDataBase64,
        size: $size,
        lastModified: $lastModified,
        status: $status
      };`,
      {
        messageId: attachment.messageId,
        type: attachment.type,
        name: attachment.name,
        mimeType: attachment.mimeType,
        path: attachment.path ?? null,
        inlineDataBase64: attachment.inlineDataBase64 ?? null,
        size: attachment.size,
        lastModified: attachment.lastModified,
        status: attachment.status,
      },
    );

    if (!records[0]) throw new Error('Attachment create failed.');
    return toAttachment(records[0]);
  }

  async listByMessage(messageId: string): Promise<AttachmentRef[]> {
    try {
      const [records = []] = await this.db.query<AttachmentRecord[]>(
        `SELECT * FROM ${TABLE} WHERE messageId = $messageId;`,
        { messageId },
      );
      return records.map(toAttachment);
    } catch {
      return [];
    }
  }

  async updateStatus(id: string, status: AttachmentStatus): Promise<AttachmentRef> {
    const [records = []] = await this.db.query<AttachmentRecord[]>(
      `UPDATE ${TABLE} SET status = $status WHERE id = $id;`,
      { id: createRecordId(TABLE, id), status },
    );
    if (!records[0]) throw new Error(`Attachment not found: ${id}`);
    return toAttachment(records[0]);
  }
}
