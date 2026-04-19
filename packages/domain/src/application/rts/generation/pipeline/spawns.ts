import {
  Generation,
  getTerrainMetadata,
  type AltitudeMap,
  type SeededRng,
  type TerrainKind,
  type TilePos,
} from '../../../../shared/rts/index.js';

interface PlaceSpawnsInput {
  terrain: TerrainKind[][];
  altitude: AltitudeMap;
  size: { cols: number; rows: number };
  factionCount: number;
  symmetry: Generation.SymmetryMode;
  rng: SeededRng;
  spawnOrderSalt?: number;
}

export function placeSpawns(input: PlaceSpawnsInput): { factionId: string; tile: TilePos }[] | null {
  const { terrain, size, factionCount, symmetry, rng } = input;
  if (factionCount <= 0) return [];

  const candidates: TilePos[] = [];
  for (let row = 2; row < size.rows - 2; row++) {
    for (let col = 2; col < size.cols - 2; col++) {
      const t = terrain[row]?.[col] as TerrainKind | undefined;
      if (!t || t === 'cliff' || !getTerrainMetadata(t).walkable) continue;
      // Prefer flat 3x3 neighborhoods.
      let flatness = 0;
      const a0 = input.altitude.levels[row]?.[col] ?? 0;
      let bad = false;
      for (let dr = -1; dr <= 1 && !bad; dr++) {
        for (let dc = -1; dc <= 1 && !bad; dc++) {
          const nr = row + dr;
          const nc = col + dc;
          if (nr < 0 || nr >= size.rows || nc < 0 || nc >= size.cols) { bad = true; break; }
          const nt = terrain[nr]?.[nc] as TerrainKind | undefined;
          if (!nt || nt === 'cliff' || !getTerrainMetadata(nt).walkable) { bad = true; break; }
          if (Math.abs((input.altitude.levels[nr]?.[nc] ?? 0) - a0) <= 0) flatness++;
        }
      }
      if (!bad && flatness >= 6) candidates.push({ col, row });
    }
  }
  if (candidates.length === 0) return null;

  // Pick base spawn and mirror.
  const baseIdx = rng.int(0, candidates.length);
  const base = candidates[baseIdx]!;

  const spawns: TilePos[] = [base];
  if (factionCount > 1) {
    const mirrored = Generation.mirrorTile(base, symmetry, size);
    spawns.push(mirrored);
  }
  if (factionCount > 2) {
    spawns.push(Generation.mirrorTile(base, 'mirrorV', size));
  }
  if (factionCount > 3) {
    spawns.push(Generation.mirrorTile(base, 'rotational180', size));
  }

  // Validate placements.
  const seen = new Set<string>();
  for (const s of spawns) {
    if (s.col < 0 || s.row < 0 || s.col >= size.cols || s.row >= size.rows) return null;
    const key = `${s.col},${s.row}`;
    if (seen.has(key)) return null;
    seen.add(key);
    const t = terrain[s.row]?.[s.col] as TerrainKind | undefined;
    if (!t || t === 'cliff' || !getTerrainMetadata(t).walkable) return null;
  }

  // Apply spawnOrderSalt to choose faction-0 vs faction-1 mirror.
  if (input.spawnOrderSalt && spawns.length >= 2) {
    const tmp = spawns[0]!;
    spawns[0] = spawns[1]!;
    spawns[1] = tmp;
  }

  return spawns.slice(0, factionCount).map((tile, i) => ({ factionId: `p${i + 1}`, tile }));
}
