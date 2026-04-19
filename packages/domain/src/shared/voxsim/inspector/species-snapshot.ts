/**
 * NEAT species snapshot consumed by `SpeciesListView` and the topology
 * coloring layer. The `color` field is sourced from the deterministic
 * species palette (see `species-palette.ts`).
 */

export interface InspectorSpeciesEntry {
  id: number;
  size: number;
  bestScore: number;
  meanScore: number;
  stagnation: number;
  representativeGenomeId: string;
  color: string;
}

export interface InspectorSpeciesSnapshot {
  runId: string;
  generation: number;
  species: InspectorSpeciesEntry[];
}
