/**
 * Shared mapping helpers for the voxsim Surreal repositories. Encodes
 * `Uint8Array` blobs as base64 strings so the SurrealDB JSON path round-trips
 * cleanly across mem:// and remote backends. Tests cover round-trip equality.
 */

export function encodeBytes(bytes: Uint8Array): string {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
}

export function decodeBytes(encoded: unknown): Uint8Array {
  if (encoded instanceof Uint8Array) return new Uint8Array(encoded);
  if (typeof encoded === 'string') {
    const buf = Buffer.from(encoded, 'base64');
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  return new Uint8Array(0);
}

export function isTableMissing(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string' &&
    /table .* does not exist/i.test((error as { message: string }).message)
  );
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Strip Surreal record-id prefixes ("table:abc") to plain ids. */
export function stripPrefix(value: string): string {
  const bracketed = value.match(/^[^:]+:⟨(.+)⟩$/);
  if (bracketed) return bracketed[1]!;
  const plain = value.match(/^[^:]+:(.+)$/);
  if (plain) return plain[1]!;
  return value;
}

/** Strip a Surreal record-id prefix when the value is in a record-typed field. */
export function stripIdField(value: unknown): string {
  if (typeof value === 'string') return stripPrefix(value);
  if (value && typeof value === 'object') {
    const id = (value as { id?: unknown; tb?: unknown }).id;
    if (typeof id === 'string') return id;
  }
  return String(value);
}
