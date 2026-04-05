import type { Surreal } from 'surrealdb';
import type { IDbClient } from '../../core/interfaces/IDbClient.js';
import { extractRecordId, isRecordId } from '../../core/types/db-types.js';
import type { IRecordId } from '../../core/types/db-types.js';

/**
 * SurrealDbAdapter - Adapts Surreal client to IDbClient interface
 * 
 * This adapter allows domain services to depend on the abstract IDbClient
 * interface rather than the concrete Surreal class, maintaining clean
 * architecture boundaries.
 * 
 * @example
 * const surreal = await getDomainDb(config);
 * const adapter = new SurrealDbAdapter(surreal);
 * const service = new SomeService(() => Promise.resolve(adapter));
 */
export class SurrealDbAdapter implements IDbClient {
  constructor(private readonly db: Surreal) {}

  /**
   * Execute a SurrealQL query
   * @returns Array of results, one element per statement in the query
   */
  async query<T = unknown>(surql: string, vars?: Record<string, unknown>): Promise<T[]> {
    const result = await this.db.query(surql, vars);
    return this.normalize(result) as T[];
  }

  /**
   * Select all records from a table or a specific record
   */
  async select<T>(thing: string | IRecordId<string>): Promise<T[]> {
    const result = await this.db.select(thing as any);
    const normalized = this.normalize(result);
    return Array.isArray(normalized) ? (normalized as T[]) : [normalized as T];
  }

  /**
   * Create a new record
   */
  async create<T, U extends Record<string, unknown> = Record<string, unknown>>(
    thing: string | IRecordId<string>,
    data?: U
  ): Promise<T[]> {
    const result = await this.db.create(thing as any, data);
    const normalized = this.normalize(result);
    return Array.isArray(normalized) ? (normalized as T[]) : [normalized as T];
  }

  /**
   * Update a record (replace)
   */
  async update<T, U extends Record<string, unknown>>(
    thing: string | IRecordId<string>,
    data?: U
  ): Promise<T[]> {
    const result = await this.db.update(thing as any, data);
    const normalized = this.normalize(result);
    return Array.isArray(normalized) ? (normalized as T[]) : [normalized as T];
  }

  /**
   * Merge data into a record
   */
  async merge<T, U extends Record<string, unknown>>(
    thing: string | IRecordId<string>,
    data?: U
  ): Promise<T[]> {
    const result = await this.db.merge(thing as any, data);
    const normalized = this.normalize(result);
    return Array.isArray(normalized) ? (normalized as T[]) : [normalized as T];
  }

  /**
   * Delete a record
   */
  async delete<T>(thing: string | IRecordId<string>): Promise<T[]> {
    const result = await this.db.delete(thing as any);
    const normalized = this.normalize(result);
    return Array.isArray(normalized) ? (normalized as T[]) : [normalized as T];
  }

  /**
   * Get the underlying Surreal instance (for cases where direct access is needed)
   * @internal This should be used sparingly, prefer using IDbClient methods
   */
  getSurrealInstance(): Surreal {
    return this.db;
  }

  private normalize(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (isRecordId(value)) {
      return extractRecordId(value);
    }

    if (value instanceof Date) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.normalize(item));
    }

    if (typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, entry] of Object.entries(value)) {
        result[key] = this.normalize(entry);
      }
      return result;
    }

    return value;
  }
}
