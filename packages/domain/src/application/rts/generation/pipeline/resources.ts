import {
  Generation,
  type ResourceNode,
  type SeededRng,
  type TerrainKind,
  type TilePos,
  getTerrainMetadata,
} from '../../../../shared/rts/index.js';

interface PlaceResourcesInput {
  terrain: TerrainKind[][];
  size: { cols: number; rows: number };
  spawns: { factionId: string; tile: TilePos }[];
  symmetry: Generation.SymmetryMode;
  density: Generation.ResourceDensity;
  amountMultiplier: number;
  rng: SeededRng;
}

const DENSITY_TO_LINE_COUNT: Record<Generation.ResourceDensity, number> = {
  sparse: 4,
  normal: 6,
  rich: 8,
};

const DENSITY_AMOUNT_BASE: Record<Generation.ResourceDensity, number> = {
  sparse: 600,
  normal: 1000,
  rich: 1500,
};

export function placeResources(input: PlaceResourcesInput): ResourceNode[] {
  const out: ResourceNode[] = [];
  let nodeCounter = 0;

  for (const spawn of input.spawns) {
    const lineCount = DENSITY_TO_LINE_COUNT[input.density];
    const amount = Math.round(DENSITY_AMOUNT_BASE[input.density] * input.amountMultiplier);
    // Place mineral patches in a small ring near the spawn.
    let placed = 0;
    let attempts = 0;
    const ringRadius = 3;
    while (placed < lineCount && attempts < 50) {
      attempts++;
      const dx = input.rng.int(-ringRadius, ringRadius + 1);
      const dy = input.rng.int(-ringRadius, ringRadius + 1);
      if (dx === 0 && dy === 0) continue;
      const tile = { col: spawn.tile.col + dx, row: spawn.tile.row + dy };
      if (tile.col < 0 || tile.row < 0 || tile.col >= input.size.cols || tile.row >= input.size.rows) continue;
      const t = input.terrain[tile.row]?.[tile.col] as TerrainKind | undefined;
      if (!t || t === 'water' || t === 'cliff') continue;
      if (out.some((r) => r.tile.col === tile.col && r.tile.row === tile.row)) continue;
      out.push({
        id: `mineral-${++nodeCounter}`,
        kind: 'mineral',
        tile,
        amount,
      });
      placed++;
    }

    // One gas pad near the spawn.
    let gasPlaced = false;
    attempts = 0;
    while (!gasPlaced && attempts < 30) {
      attempts++;
      const dx = input.rng.int(-4, 5);
      const dy = input.rng.int(-4, 5);
      const tile = { col: spawn.tile.col + dx, row: spawn.tile.row + dy };
      if (tile.col < 0 || tile.row < 0 || tile.col >= input.size.cols || tile.row >= input.size.rows) continue;
      const t = input.terrain[tile.row]?.[tile.col] as TerrainKind | undefined;
      if (!t || t === 'water' || t === 'cliff') continue;
      if (out.some((r) => r.tile.col === tile.col && r.tile.row === tile.row)) continue;
      out.push({
        id: `gas-${++nodeCounter}`,
        kind: 'gas',
        tile,
        amount: Math.round(amount * 1.2),
      });
      gasPlaced = true;
    }
  }

  return out;
}
