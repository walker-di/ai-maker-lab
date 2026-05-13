import type { TilePos } from './iso.js';

export type ResourceKind = 'mineral' | 'gas';

export const RESOURCE_KINDS: readonly ResourceKind[] = ['mineral', 'gas'];

export interface ResourceNode {
  id: string;
  kind: ResourceKind;
  tile: TilePos;
  amount: number;
  regenPerMin?: number;
}
