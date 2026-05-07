/**
 * Versioned GT3 tire data seed.
 *
 * This is not a replacement for real tire-rig data. It is the first stable
 * data-pipeline surface: authored/fitted coefficients live in a versioned
 * dataset, the Pacejka evaluator consumes resolved axle params, and the
 * validation harness can fingerprint the active tire so plot regressions are
 * tied to data revisions rather than anonymous constants.
 */

import type { Pacejka56Axle, Pacejka56AxleParams } from './pacejka.js';

export type TireDatasetSourceKind = 'synthetic-fit' | 'measured-rig' | 'external-reference';

export interface TireDatasetMetadata {
  /** Stable dataset id, e.g. `gt3-rwd-slick`. */
  id: string;
  /** Semver-like data revision. Bump whenever fitted coefficients change. */
  version: string;
  /** What kind of source produced this dataset. */
  sourceKind: TireDatasetSourceKind;
  /** Short human-readable source note for telemetry / reports. */
  sourceNote: string;
  /** Car class this tire was fitted for. */
  carClass: 'gt3-rwd';
  /** Tire family / compound bucket. */
  compound: 'slick-dry';
}

export interface TireRelaxationDataset {
  /** Baseline longitudinal relaxation length at reference load (m). */
  longitudinalM: number;
  /** Baseline lateral relaxation length at reference load (m). */
  lateralM: number;
}

export interface TireThermalDataset {
  /** Nominal peak-grip tread temperature (degrees C). */
  optimalTempC: number;
  /** Approximate useful operating window half-width (degrees C). */
  windowHalfWidthC: number;
}

export interface TirePressureDataset {
  /** Nominal cold pressure (kPa). */
  coldKpa: number;
  /** Nominal hot pressure target for peak grip (kPa). */
  optimalHotKpa: number;
}

export interface VersionedTireDataset {
  metadata: TireDatasetMetadata;
  front: Pacejka56AxleParams;
  rear: Pacejka56AxleParams;
  relaxation: TireRelaxationDataset;
  pressure: TirePressureDataset;
  thermal: TireThermalDataset;
}

const GT3_COMMON_PACEJKA: Pacejka56AxleParams = {
  fz0: 3500,

  pCx1: 1.65,
  pDx1: 1.0,
  pDx2: -0.12,
  pKx1: 25,
  pKx2: 0,
  pEx1: 0.95,
  pEx2: 0,

  pCy1: 1.3,
  pDy1: 1.0,
  pDy2: -0.12,
  pKy1: 22.5,
  pKy2: 1.5,
  pEy1: -1.4,
  pEy2: 0,
  pCy2: 1.5,

  rBx1: 2.5,
  rCx1: 1.0,
  rBy1: 2.5,
  rCy1: 1.0,
};

export const GT3_RWD_SLICK_TIRE_DATASET: VersionedTireDataset = {
  metadata: {
    id: 'gt3-rwd-slick',
    version: '0.1.0-synthetic',
    sourceKind: 'synthetic-fit',
    sourceNote: 'Synthetic GT3 slick seed fitted to the legacy MF 5.6 baseline; replace with measured rig data when available.',
    carClass: 'gt3-rwd',
    compound: 'slick-dry',
  },
  front: { ...GT3_COMMON_PACEJKA },
  rear: { ...GT3_COMMON_PACEJKA },
  relaxation: {
    longitudinalM: 0.4,
    lateralM: 0.55,
  },
  pressure: {
    coldKpa: 200,
    optimalHotKpa: 200,
  },
  thermal: {
    optimalTempC: 90,
    windowHalfWidthC: 60,
  },
};

export const GT3_RWD_SLICK_PACEJKA56_PARAMS = {
  front: GT3_RWD_SLICK_TIRE_DATASET.front,
  rear: GT3_RWD_SLICK_TIRE_DATASET.rear,
} as const;

export function resolveTireAxleParams(
  dataset: VersionedTireDataset,
  axle: Pacejka56Axle,
  override?: Partial<Pacejka56AxleParams>,
): Pacejka56AxleParams {
  const base = axle === 'front' ? dataset.front : dataset.rear;
  return override ? { ...base, ...override } : { ...base };
}

export function tireDatasetFingerprint(dataset: VersionedTireDataset): string {
  const ordered = [
    dataset.metadata.id,
    dataset.metadata.version,
    ...Object.values(dataset.front),
    ...Object.values(dataset.rear),
    dataset.relaxation.longitudinalM,
    dataset.relaxation.lateralM,
    dataset.pressure.coldKpa,
    dataset.pressure.optimalHotKpa,
    dataset.thermal.optimalTempC,
    dataset.thermal.windowHalfWidthC,
  ];
  return ordered.map((v) => typeof v === 'number' ? Number(v).toFixed(6) : v).join('|');
}
