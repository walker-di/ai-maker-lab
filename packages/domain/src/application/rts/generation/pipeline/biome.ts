import type { AltitudeMap, TerrainKind } from '../../../../shared/rts/index.js';

export function buildBiomeTerrain(
  altitude: AltitudeMap,
  size: { cols: number; rows: number },
  maxAltitude: number,
): TerrainKind[][] {
  const out: TerrainKind[][] = [];
  for (let row = 0; row < size.rows; row++) {
    const line: TerrainKind[] = [];
    for (let col = 0; col < size.cols; col++) {
      const a = altitude.levels[row]?.[col] ?? 0;
      const ratio = maxAltitude === 0 ? 0 : a / maxAltitude;
      let kind: TerrainKind = 'grass';
      if (ratio >= 0.66) kind = 'rock';
      else if (ratio >= 0.34) kind = 'dirt';
      line.push(kind);
    }
    out.push(line);
  }
  return out;
}
