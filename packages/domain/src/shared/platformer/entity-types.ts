export const ENTITY_KINDS = [
  'player',
  'walkerEnemy',
  'shellEnemy',
  'flyingEnemy',
  'fireBar',
  'bulletShooter',
  'coin',
  'mushroom',
  'flower',
  'star',
  'oneUp',
  'platformMoving',
  'spring',
] as const;

export type EntityKind = (typeof ENTITY_KINDS)[number];

export type EntityParamValue = number | string | boolean;

export interface EntitySpawn {
  readonly kind: EntityKind;
  readonly tile: { readonly col: number; readonly row: number };
  readonly params?: Readonly<Record<string, EntityParamValue>>;
}

/**
 * Entity kinds the editor's entity palette is allowed to place. Player spawns are
 * configured through the dedicated spawn tool.
 */
export const PLACEABLE_ENTITY_KINDS = ENTITY_KINDS.filter(
  (kind) => kind !== 'player',
) as readonly EntityKind[];
