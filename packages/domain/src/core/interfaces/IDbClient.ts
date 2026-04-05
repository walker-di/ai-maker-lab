/**
 * IDbClient - Database client interface
 * 
 * Abstracts the database client to prevent infrastructure leakage into domains.
 * Domain services should depend on this interface, not concrete implementations.
 * 
 * @example
 * class WorkItemService {
 *   constructor(private readonly getDb: IDbClientFactory) {}
 * }
 */

import type { IRecordId } from '../types/db-types.js';

/**
 * Query result type - maps to SurrealDB query results
 * Each query returns an array of results for each statement
 */
export type QueryResult<T> = T;

/**
 * Database client interface
 * Matches SurrealDB client API for compatibility
 */
export interface IDbClient {
  /**
   * Execute a SurrealQL query
   * @returns Array of results, one element per statement in the query
   */
  query<T = unknown>(surql: string, vars?: Record<string, unknown>): Promise<T[]>;

  /**
   * Select all records from a table or a specific record
   */
  select<T>(thing: string | IRecordId<string>): Promise<T[]>;

  /**
   * Create a new record
   */
  create<T, U extends Record<string, unknown> = Record<string, unknown>>(thing: string | IRecordId<string>, data?: U): Promise<T[]>;

  /**
   * Update a record (replace)
   */
  update<T, U extends Record<string, unknown>>(thing: string | IRecordId<string>, data?: U): Promise<T[]>;

  /**
   * Merge data into a record
   */
  merge<T, U extends Record<string, unknown>>(thing: string | IRecordId<string>, data?: U): Promise<T[]>;

  /**
   * Delete a record
   */
  delete<T>(thing: string | IRecordId<string>): Promise<T[]>;
}

/**
 * Factory function type for creating database client instances
 * This is the type that domain services should use for dependency injection
 */
export type IDbClientFactory = () => Promise<IDbClient>;
