export type UnitKind = 'worker' | 'rifleman' | 'rocket' | 'scout';

export const UNIT_KINDS: readonly UnitKind[] = ['worker', 'rifleman', 'rocket', 'scout'];

export type BuildingKind = 'hq' | 'barracks' | 'factory' | 'refinery' | 'depot' | 'turret';

export const BUILDING_KINDS: readonly BuildingKind[] = [
  'hq',
  'barracks',
  'factory',
  'refinery',
  'depot',
  'turret',
];

export type TechKind = 'armorT1' | 'armorT2' | 'weaponT1' | 'weaponT2' | 'sightRange';

export const TECH_KINDS: readonly TechKind[] = [
  'armorT1',
  'armorT2',
  'weaponT1',
  'weaponT2',
  'sightRange',
];
