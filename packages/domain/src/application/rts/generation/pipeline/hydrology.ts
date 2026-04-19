import type { AltitudeMap, TerrainKind } from '../../../../shared/rts/index.js';

/**
 * Layers water and shallow tiles into a terrain map by promoting the lowest
 * altitude band according to `waterAmount`. The terrain is mutated in place.
 */
export function applyHydrology(
  terrain: TerrainKind[][],
  altitude: AltitudeMap,
  waterAmount: number,
): void {
  if (waterAmount <= 0) return;
  const rows = terrain.length;
  if (rows === 0) return;
  const cols = terrain[0]!.length;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const a = altitude.levels[row]?.[col] ?? 0;
      // promote bottom band to water/shallow per amount.
      // amount=1 -> any 0-altitude becomes water; amount<0.5 -> only if isolated
      if (a === 0) {
        const r = pseudoRand(col, row);
        if (r < waterAmount) terrain[row]![col] = 'water';
        else if (r < waterAmount + 0.15) terrain[row]![col] = 'shallow';
      }
    }
  }
}

function pseudoRand(col: number, row: number): number {
  const h = ((col * 73856093) ^ (row * 19349663)) >>> 0;
  return ((h % 10_000) / 10_000);
}
