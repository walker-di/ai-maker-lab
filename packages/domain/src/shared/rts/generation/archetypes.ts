export type MapArchetype = 'open-field' | 'cliffs-and-ramps' | 'island-shores';

export const MAP_ARCHETYPES: readonly MapArchetype[] = [
  'open-field',
  'cliffs-and-ramps',
  'island-shores',
];

export interface ArchetypeGuards {
  /** Minimum cols/rows; the generator clamps to this size. */
  minSize: { cols: number; rows: number };
  /** Suggested altitude amplitude bias; the pipeline multiplies its noise output by this. */
  altitudeAmplitude: number;
  /** Suggested water amount bias; ignored for `open-field`. */
  waterBias: number;
  /** Default symmetry hint when callers do not provide one explicitly. */
  defaultSymmetry: 'mirrorH' | 'mirrorV' | 'rotational180' | 'none';
}

export const ARCHETYPE_GUARDS: Readonly<Record<MapArchetype, ArchetypeGuards>> = {
  'open-field':       { minSize: { cols: 16, rows: 16 }, altitudeAmplitude: 0.4, waterBias: 0.0, defaultSymmetry: 'mirrorH' },
  'cliffs-and-ramps': { minSize: { cols: 24, rows: 24 }, altitudeAmplitude: 1.0, waterBias: 0.0, defaultSymmetry: 'rotational180' },
  'island-shores':    { minSize: { cols: 24, rows: 24 }, altitudeAmplitude: 0.7, waterBias: 0.4, defaultSymmetry: 'mirrorH' },
};
