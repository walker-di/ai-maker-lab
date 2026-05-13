import type {
  AltitudeMap,
  SeededRng,
  TerrainKind,
} from '../../../../shared/rts/index.js';

/**
 * Promotes the lower side of any altitude transition to a `cliff` terrain,
 * then demotes a `ramps`-many seeded subset back to walkable per altitude
 * level so plateaus stay reachable. Mutates `terrain` in place.
 */
export function applyCliffsAndRamps(
  terrain: TerrainKind[][],
  altitude: AltitudeMap,
  rng: SeededRng,
  ramps: number,
  maxAltitude: number,
): void {
  const rows = terrain.length;
  const cols = terrain[0]?.length ?? 0;
  const cliffsByLevel: Map<number, { col: number; row: number }[]> = new Map();

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const a = altitude.levels[row]?.[col] ?? 0;
      let isCliff = false;
      let upperLevel = a;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        const na = altitude.levels[nr]?.[nc] ?? 0;
        if (na > a) {
          isCliff = true;
          upperLevel = Math.max(upperLevel, na);
        }
      }
      if (isCliff && terrain[row]![col] !== 'water' && terrain[row]![col] !== 'shallow') {
        terrain[row]![col] = 'cliff';
        const list = cliffsByLevel.get(upperLevel) ?? [];
        list.push({ col, row });
        cliffsByLevel.set(upperLevel, list);
      }
    }
  }

  for (let level = 1; level <= maxAltitude; level++) {
    const list = cliffsByLevel.get(level);
    if (!list || list.length === 0) continue;
    const want = Math.min(list.length, Math.max(1, ramps));
    for (let i = 0; i < want; i++) {
      const idx = rng.int(0, list.length);
      const tile = list[idx]!;
      terrain[tile.row]![tile.col] = level >= 2 ? 'rock' : 'dirt';
    }
  }
}
