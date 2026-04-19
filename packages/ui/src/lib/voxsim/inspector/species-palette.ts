/**
 * Deterministic species palette. Hashes `(runId, speciesId)` to produce a
 * stable HSL color so the same species keeps the same color across re-renders
 * and across sessions.
 */

function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function speciesColor(runId: string, speciesId: number): string {
  const seed = hashString(`${runId}#${speciesId}`);
  const hue = seed % 360;
  const sat = 55 + ((seed >>> 9) % 25);
  const light = 45 + ((seed >>> 17) % 15);
  return `hsl(${hue} ${sat}% ${light}%)`;
}

export function buildSpeciesPalette(
  runId: string,
  speciesIds: readonly number[],
): Record<number, string> {
  const palette: Record<number, string> = {};
  for (const id of speciesIds) palette[id] = speciesColor(runId, id);
  return palette;
}
