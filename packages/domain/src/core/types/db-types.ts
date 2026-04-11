/**
 * Database types abstraction
 * 
 * These types abstract SurrealDB-specific types to prevent infrastructure leakage.
 * Domain services should use these types instead of importing from 'surrealdb' directly.
 */

/**
 * Generic RecordId interface
 * Represents a database record identifier with table and id components
 * 
 * @example
 * // Use with the createRecordId factory from infrastructure
 * const userId: IRecordId<'user'> = createRecordId('user', 'abc123');
 */
export interface IRecordId<T extends string = string> {
  /** The table name */
  readonly tb: T;
  /** The record ID value */
  readonly id: string | number | bigint | object;
  /** String representation of the RecordId */
  toString(): string;
}

/**
 * RecordId constructor interface
 * Used for creating RecordId instances
 */
export interface IRecordIdConstructor {
  new <T extends string>(tb: T, id: string | number | bigint | object): IRecordId<T>;
}

/**
 * Type for extracting the ID part from a RecordId
 */
export type ExtractRecordId<T> = T extends IRecordId<infer U> ? U : never;

/**
 * Factory function type for creating RecordId instances
 * Domain services use this factory instead of directly constructing RecordIds
 */
export type RecordIdFactory = <T extends string>(tb: T, id: string | number | bigint | object) => IRecordId<T>;

/**
 * Type guard to check if a value is a RecordId
 */
export function isRecordId(value: unknown): value is IRecordId<string> {
  return (
    value !== null &&
    typeof value === 'object' &&
    'tb' in value &&
    'id' in value &&
    typeof (value as IRecordId).tb === 'string'
  );
}

/**
 * Helper to extract the raw ID from a RecordId
 */
export function extractRecordId(recordId: IRecordId<string>): string {
  return String(recordId.id);
}

/**
 * Helper to extract the table name from a RecordId
 */
export function extractTable(recordId: IRecordId<string>): string {
  return recordId.tb;
}
