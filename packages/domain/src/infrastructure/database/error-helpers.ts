/**
 * Checks whether a SurrealDB error indicates a missing table, which is
 * expected on first access with an empty in-memory database.
 *
 * Handles both the SurrealDB JS SDK NotFoundError (which has a `kind`
 * property) and plain Error objects with a matching message.
 */
export function isMissingTableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const asAny = error as { kind?: string; details?: { kind?: string } };
  if (asAny.kind === 'NotFound' && asAny.details?.kind === 'Table') {
    return true;
  }

  return /table '.*' does not exist/i.test(error.message);
}
