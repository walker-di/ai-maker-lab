import type { MapArchetype } from './archetypes.js';
import type { SymmetryMode } from './symmetry.js';

export type ResourceDensity = 'sparse' | 'normal' | 'rich';
export type AltitudeRoughness = 'flat' | 'rolling' | 'rugged';

export interface MapGenerationParams {
  seed: number;
  archetype: MapArchetype;
  size: { cols: number; rows: number };
  maxAltitude: number;
  factionCount: number;
  symmetry: SymmetryMode;
  resourceDensity: ResourceDensity;
  altitudeRoughness: AltitudeRoughness;
  /** 0..1 fraction of the bottom altitude band promoted to water. */
  waterAmount: number;
  /** Number of ramps emitted per altitude transition. */
  ramps: number;
  /** Increment when changing pipeline output for the same inputs. */
  version: number;
  /** Tweak knob — flips which mirrored spawn becomes faction `0`. */
  spawnOrderSalt?: number;
  /** Continuous resource amount multiplier applied on top of resourceDensity. */
  resourceAmountMultiplier?: number;
}

export const RESOURCE_DENSITIES: readonly ResourceDensity[] = ['sparse', 'normal', 'rich'];
export const ALTITUDE_ROUGHNESS: readonly AltitudeRoughness[] = ['flat', 'rolling', 'rugged'];
export const MAP_GENERATION_PARAMS_VERSION = 1;
