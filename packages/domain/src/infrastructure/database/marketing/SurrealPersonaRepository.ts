import type { IDbClient } from '../../../core/interfaces/IDbClient.js';
import type { IPersonaRepository } from '../../../application/marketing/ports.js';
import type { Persona, CreatePersonaDto, UpdatePersonaDto, AgeRange, Gender } from '../../../shared/marketing/index.js';
import { isMissingTableError } from '../error-helpers.js';
import { createRecordId, normalizeRecordIdValue } from '../record-id.js';

const TABLE = 'marketing_persona';

type PersonaRecord = {
  id: unknown;
  productId: string;
  name: string;
  age?: number;
  ageRange: AgeRange;
  gender: Gender;
  occupation?: string;
  income?: string;
  interests: string[];
  painPoints: string[];
  motivations: string[];
  description?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
};

function toPersona(record: PersonaRecord): Persona {
  return {
    id: normalizeRecordIdValue(String(record.id)),
    productId: record.productId,
    name: record.name,
    age: record.age,
    ageRange: record.ageRange,
    gender: record.gender,
    occupation: record.occupation,
    income: record.income,
    interests: record.interests ?? [],
    painPoints: record.painPoints ?? [],
    motivations: record.motivations ?? [],
    description: record.description,
    avatarUrl: record.avatarUrl,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export class SurrealPersonaRepository implements IPersonaRepository {
  constructor(private readonly db: IDbClient) {}

  async findAll(): Promise<Persona[]> {
    try {
      const [records = []] = await this.db.query<PersonaRecord[]>(
        `SELECT * FROM ${TABLE} ORDER BY createdAt;`,
      );
      return records.map(toPersona);
    } catch (error) {
      if (isMissingTableError(error)) return [];
      throw error;
    }
  }

  async findById(id: string): Promise<Persona | null> {
    try {
      const records = await this.db.select<PersonaRecord>(createRecordId(TABLE, id));
      const record = records[0];
      return record ? toPersona(record) : null;
    } catch (error) {
      if (isMissingTableError(error)) return null;
      throw error;
    }
  }

  async findByProductId(productId: string): Promise<Persona[]> {
    try {
      const [records = []] = await this.db.query<PersonaRecord[]>(
        `SELECT * FROM ${TABLE} WHERE productId = $productId ORDER BY createdAt;`,
        { productId },
      );
      return records.map(toPersona);
    } catch (error) {
      if (isMissingTableError(error)) return [];
      throw error;
    }
  }

  async create(data: CreatePersonaDto): Promise<Persona> {
    const now = new Date().toISOString();
    const [records = []] = await this.db.query<PersonaRecord[]>(
      `CREATE ${TABLE} CONTENT $data;`,
      { data: { ...data, createdAt: now, updatedAt: now } },
    );
    const created = records[0];
    if (!created) throw new Error('Persona create failed.');
    return toPersona(created);
  }

  async update(id: string, data: UpdatePersonaDto): Promise<Persona> {
    const existing = await this.findById(id);
    if (!existing) throw new Error(`Persona not found: ${id}`);

    const now = new Date().toISOString();
    const records = await this.db.update<PersonaRecord, Record<string, unknown>>(
      createRecordId(TABLE, id),
      { ...data, updatedAt: now },
    );
    const updated = records[0];
    if (!updated) throw new Error(`Persona update failed for id: ${id}`);
    return toPersona(updated);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete<PersonaRecord>(createRecordId(TABLE, id));
  }
}
