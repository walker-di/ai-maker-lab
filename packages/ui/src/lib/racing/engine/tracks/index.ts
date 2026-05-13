export { sampleCentripetal, type SampledPoint, type CenterlineCtrl } from './catmull-rom.js';
export {
  buildRibbonEdges,
  findRibbonIntersection,
  isLoopClosed,
  type RibbonEdges,
} from './ribbon-geometry.js';
export {
  SurfaceLookup,
  type SurfaceLookupConfig,
  type SurfaceZoneInput,
} from './surface-lookup.js';
export {
  placeScenery,
  type PropKind,
  type PropPlacement,
  type SceneryPlacementInput,
} from './scenery-placement.js';
export {
  ElevationMap,
  HeightField,
  TerrainContact,
  type ElevationSample,
  type HeightFieldParams,
} from './elevation.js';
export {
  kerbContactAt,
  kerbContactFromLateralOffset,
  DEFAULT_KERB_PROFILE,
  type KerbProfile,
  type KerbContact,
} from './kerb-geometry.js';
