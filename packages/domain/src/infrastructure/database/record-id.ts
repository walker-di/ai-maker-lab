/**
 * RecordId factory and utilities
 * 
 * Provides the concrete implementation of RecordId for SurrealDB.
 * 
 * ⚠️ IMPORTANT: This should ONLY be used in the infrastructure layer (repositories).
 * 
 * DO NOT import this in:
 * - API layer (apps/web/src/routes/api/)
 * - Domain services (packages/domain/src/domains/.../services/)
 * 
 * The correct pattern:
 * - API layer passes plain strings to services
 * - Services pass plain strings to repositories
 * - Repositories use createRecordId internally
 */

import { RecordId } from 'surrealdb';
import type { IRecordId, RecordIdFactory } from '../../core/types/db-types.js';

export function normalizeRecordIdValue(value: string): string {
  const bracketedMatch = value.match(/^[^:]+:⟨(.+)⟩$/);
  if (bracketedMatch) {
    return bracketedMatch[1];
  }

  const plainMatch = value.match(/^[^:]+:(.+)$/);
  if (plainMatch) {
    return plainMatch[1];
  }

  return value;
}

/**
 * Create a RecordId instance
 * 
 * ⚠️ ONLY use in Surreal*Repository implementations (infrastructure layer)
 * 
 * @example
 * // In SurrealUserRepository.ts (CORRECT)
 * import { createRecordId } from '../../database/record-id.js';
 * const userId = createRecordId('user', 'abc123');
 * 
 * // In API endpoint (WRONG - violates layer boundaries)
 * // import { createRecordId } from '@pic-flow/domain/infrastructure';
 */
export const createRecordId: RecordIdFactory = <T extends string>(
  tb: T,
  id: string | number | bigint | object
): IRecordId<T> => {
  const normalizedId = typeof id === 'string' ? normalizeRecordIdValue(id) : id;
  // Cast to any first to handle the broader object type
  return new RecordId(tb, normalizedId as string) as unknown as IRecordId<T>;
};

/**
 * Re-export RecordId class for infrastructure layer usage
 * 
 * @note This should only be used in infrastructure layer (repositories, adapters)
 * Domain services should use createRecordId factory instead
 */
export { RecordId };

/**
 * Type alias for backwards compatibility
 */
export type { IRecordId } from '../../core/types/db-types.js';
