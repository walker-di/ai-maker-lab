export type TerrainKind = 'grass' | 'dirt' | 'rock' | 'water' | 'shallow' | 'cliff';

export const TERRAIN_KINDS: readonly TerrainKind[] = [
  'grass',
  'dirt',
  'rock',
  'water',
  'shallow',
  'cliff',
];

export interface TerrainMetadata {
  readonly walkable: boolean;
  readonly buildable: boolean;
  readonly swimmable: boolean;
  readonly blocksVision: boolean;
  readonly blocksProjectiles: boolean;
}

const TERRAIN_METADATA: Readonly<Record<TerrainKind, TerrainMetadata>> = {
  grass:   { walkable: true,  buildable: true,  swimmable: false, blocksVision: false, blocksProjectiles: false },
  dirt:    { walkable: true,  buildable: true,  swimmable: false, blocksVision: false, blocksProjectiles: false },
  rock:    { walkable: true,  buildable: true,  swimmable: false, blocksVision: false, blocksProjectiles: false },
  water:   { walkable: false, buildable: false, swimmable: true,  blocksVision: false, blocksProjectiles: false },
  shallow: { walkable: true,  buildable: false, swimmable: true,  blocksVision: false, blocksProjectiles: false },
  cliff:   { walkable: false, buildable: false, swimmable: false, blocksVision: true,  blocksProjectiles: true  },
};

export function getTerrainMetadata(kind: TerrainKind): TerrainMetadata {
  return TERRAIN_METADATA[kind];
}
