/**
 * Surface palette consumed by the racing tire model. `mu` is the friction
 * coefficient, `roll` is rolling resistance, and `color` is the visual hex
 * colour the renderer paints zones with. The seven IDs match the prototype's
 * surface palette and the workspace UI mirror in `packages/ui/.../racing/types.ts`.
 */

export type SurfaceId =
  | 'RUBBER'
  | 'ASPHALT'
  | 'MARBLES'
  | 'DAMP'
  | 'CURB'
  | 'GRASS'
  | 'GRAVEL';

export interface SurfaceDef {
  id: SurfaceId;
  mu: number;
  roll: number;
  color: number;
}

export const SURFACES: Readonly<Record<SurfaceId, SurfaceDef>> = Object.freeze({
  RUBBER: { id: 'RUBBER', mu: 1.08, roll: 0.013, color: 0x1c232d },
  ASPHALT: { id: 'ASPHALT', mu: 1.0, roll: 0.015, color: 0x232830 },
  MARBLES: { id: 'MARBLES', mu: 0.82, roll: 0.02, color: 0x3b4048 },
  DAMP: { id: 'DAMP', mu: 0.74, roll: 0.018, color: 0x1b2730 },
  CURB: { id: 'CURB', mu: 0.85, roll: 0.04, color: 0xb13c3c },
  GRASS: { id: 'GRASS', mu: 0.45, roll: 0.1, color: 0x33632e },
  GRAVEL: { id: 'GRAVEL', mu: 0.3, roll: 0.18, color: 0x6b5a32 },
});

export const SURFACE_IDS: readonly SurfaceId[] = Object.freeze([
  'RUBBER',
  'ASPHALT',
  'MARBLES',
  'DAMP',
  'CURB',
  'GRASS',
  'GRAVEL',
]);

export function getSurface(id: SurfaceId): SurfaceDef {
  return SURFACES[id];
}
