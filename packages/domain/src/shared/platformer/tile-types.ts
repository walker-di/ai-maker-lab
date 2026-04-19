export const TILE_KINDS = [
  'empty',
  'ground',
  'brick',
  'question',
  'hardBlock',
  'pipeTop',
  'pipeBody',
  'flagPole',
  'flagBase',
  'coinTile',
  'hazard',
] as const;

export type TileKind = (typeof TILE_KINDS)[number];

export interface TileMetadata {
  readonly solid: boolean;
  readonly breakable: boolean;
  readonly bumpable: boolean;
  readonly oneWay: boolean;
  readonly hazardous: boolean;
}

const TILE_METADATA: Readonly<Record<TileKind, TileMetadata>> = {
  empty:     { solid: false, breakable: false, bumpable: false, oneWay: false, hazardous: false },
  ground:    { solid: true,  breakable: false, bumpable: false, oneWay: false, hazardous: false },
  brick:     { solid: true,  breakable: true,  bumpable: true,  oneWay: false, hazardous: false },
  question:  { solid: true,  breakable: false, bumpable: true,  oneWay: false, hazardous: false },
  hardBlock: { solid: true,  breakable: false, bumpable: false, oneWay: false, hazardous: false },
  pipeTop:   { solid: true,  breakable: false, bumpable: false, oneWay: false, hazardous: false },
  pipeBody:  { solid: true,  breakable: false, bumpable: false, oneWay: false, hazardous: false },
  flagPole:  { solid: false, breakable: false, bumpable: false, oneWay: false, hazardous: false },
  flagBase:  { solid: true,  breakable: false, bumpable: false, oneWay: false, hazardous: false },
  coinTile:  { solid: false, breakable: false, bumpable: false, oneWay: false, hazardous: false },
  hazard:    { solid: false, breakable: false, bumpable: false, oneWay: false, hazardous: true  },
};

export function getTileMetadata(kind: TileKind): TileMetadata {
  return TILE_METADATA[kind];
}

export function isSolidTile(kind: TileKind): boolean {
  return TILE_METADATA[kind].solid;
}
