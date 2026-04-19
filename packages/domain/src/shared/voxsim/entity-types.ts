import type { Transform } from './vec.js';

/**
 * Agent and non-agent spawn descriptors. Bound by the engine on `loadArena`.
 *
 * `bodyDnaRef` and `brainDnaRef` are populated by plans 03 and 04 once those
 * subdomains exist. They are reserved here so plan 01 arenas can be authored
 * end-to-end without breaking changes downstream.
 */

export interface AgentSpawn {
  id: string;
  /** Human-readable label shown in the inspector and editor. */
  tag: string;
  pose: Transform;
  /** Reserved for `03-morphology-joints-and-dna.md`. */
  bodyDnaRef?: string;
  /** Reserved for `04-brain-and-policy-runtime.md`. */
  brainDnaRef?: string;
}

export type EntityKind =
  | 'propBox'
  | 'foodPile'
  | 'hazardField'
  | 'goalMarker';

export const ENTITY_KINDS: readonly EntityKind[] = [
  'propBox',
  'foodPile',
  'hazardField',
  'goalMarker',
] as const;

export type EntityParamValue = number | string | boolean;

export interface EntitySpawn {
  id: string;
  kind: EntityKind;
  pose: Transform;
  /** Editor-tunable values; semantics depend on `kind`. */
  params?: Readonly<Record<string, EntityParamValue>>;
}
