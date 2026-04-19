import type { IDbClient } from '../../../core/interfaces/IDbClient.js';
import type { StoredUserAgent } from '../../../shared/chat/index.js';
import type {
  IUserAgentRepository,
  CreateUserAgentInput,
  UpdateUserAgentInput,
} from '../../../application/chat/ports.js';
import { createRecordId } from '../record-id.js';

const TABLE = 'user_agent';

type UserAgentRecord = {
  id: string;
  source: 'user';
  inheritsFromSystemAgentId?: string;
  duplicatedFromSystemAgentId?: string;
  modelCardId: string;
  systemPrompt: string;
  toolsEnabled?: boolean;
  toolOverrides: Record<string, boolean>;
  userOverrides: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

function toStoredUserAgent(record: UserAgentRecord): StoredUserAgent {
  return {
    id: record.id,
    source: 'user',
    inheritsFromSystemAgentId: record.inheritsFromSystemAgentId ?? undefined,
    duplicatedFromSystemAgentId: record.duplicatedFromSystemAgentId ?? undefined,
    modelCardId: record.modelCardId,
    systemPrompt: record.systemPrompt,
    toolsEnabled: record.toolsEnabled ?? undefined,
    toolOverrides: record.toolOverrides ?? {},
    userOverrides: record.userOverrides ?? {},
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export class SurrealUserAgentRepository implements IUserAgentRepository {
  constructor(private readonly db: IDbClient) {}

  async list(): Promise<StoredUserAgent[]> {
    try {
      const [records = []] = await this.db.query<UserAgentRecord[]>(
        `SELECT * FROM ${TABLE} ORDER BY updatedAt DESC;`,
      );
      return records.map(toStoredUserAgent);
    } catch {
      return [];
    }
  }

  async findById(id: string): Promise<StoredUserAgent | null> {
    try {
      const records = await this.db.select<UserAgentRecord>(createRecordId(TABLE, id));
      const record = records[0];
      return record ? toStoredUserAgent(record) : null;
    } catch {
      return null;
    }
  }

  async create(input: CreateUserAgentInput): Promise<StoredUserAgent> {
    const now = new Date().toISOString();
    const [records = []] = await this.db.query<UserAgentRecord[]>(
      `CREATE ${TABLE} CONTENT {
        source: $source,
        inheritsFromSystemAgentId: $inheritsFromSystemAgentId,
        duplicatedFromSystemAgentId: $duplicatedFromSystemAgentId,
        modelCardId: $modelCardId,
        systemPrompt: $systemPrompt,
        toolsEnabled: $toolsEnabled,
        toolOverrides: $toolOverrides,
        userOverrides: $userOverrides,
        createdAt: $createdAt,
        updatedAt: $updatedAt
      };`,
      {
        source: 'user',
        inheritsFromSystemAgentId: input.inheritsFromSystemAgentId ?? null,
        duplicatedFromSystemAgentId: input.duplicatedFromSystemAgentId ?? null,
        modelCardId: input.modelCardId,
        systemPrompt: input.systemPrompt,
        toolsEnabled: input.toolsEnabled ?? null,
        toolOverrides: input.toolOverrides ?? {},
        userOverrides: { name: input.name, description: input.description },
        createdAt: now,
        updatedAt: now,
      },
    );

    if (!records[0]) throw new Error('User agent create failed.');
    return toStoredUserAgent(records[0]);
  }

  async update(id: string, input: UpdateUserAgentInput): Promise<StoredUserAgent> {
    const existing = await this.findById(id);
    if (!existing) throw new Error(`User agent not found: ${id}`);

    const now = new Date().toISOString();
    const records = await this.db.update<UserAgentRecord, Record<string, unknown>>(
      createRecordId(TABLE, id),
      {
        source: 'user',
        inheritsFromSystemAgentId: existing.inheritsFromSystemAgentId ?? null,
        duplicatedFromSystemAgentId: existing.duplicatedFromSystemAgentId ?? null,
        modelCardId: input.modelCardId ?? existing.modelCardId,
        systemPrompt: input.systemPrompt ?? existing.systemPrompt,
        toolsEnabled: input.toolsEnabled ?? existing.toolsEnabled ?? null,
        toolOverrides: input.toolOverrides ?? existing.toolOverrides,
        userOverrides: { ...existing.userOverrides, ...input.userOverrides },
        createdAt: existing.createdAt,
        updatedAt: now,
      },
    );

    return toStoredUserAgent(records[0] ?? existing);
  }

  async remove(id: string): Promise<void> {
    await this.db.delete<UserAgentRecord>(createRecordId(TABLE, id));
  }
}
