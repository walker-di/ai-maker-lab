/**
 * Deterministic GT3/RWD physics-lab harness.
 *
 * The harness generates plot-ready series from the same pure tire/contact
 * helpers used by the runtime. It is intentionally browser-safe and IO-free:
 * callers can serialize the returned object to JSON, render plots elsewhere,
 * or compare the summary against numeric envelopes in tests.
 */

import {
  evaluatePacejka56Combined,
  resolveTireAxleParams,
  tireDatasetFingerprint,
  GT3_RWD_SLICK_TIRE_DATASET,
  computeContactPatchPressureDistribution,
  computeLoadSensitiveRelaxationLength,
  computeOverturningMomentNm,
  computeSlidingGripScale,
  stepRelaxedSlip,
  tirePressureMu,
  tireTempMu,
  type Pacejka56Axle,
  type VersionedTireDataset,
} from '../physics/index.js';

export interface BenchPoint {
  x: number;
  fx?: number;
  fy?: number;
  mz?: number;
  muScale?: number;
  relaxationM?: number;
  dynamic?: number;
}

export interface Gt3TireBenchResult {
  datasetId: string;
  datasetVersion: string;
  fingerprint: string;
  pureLongitudinal: BenchPoint[];
  pureLateral: BenchPoint[];
  combinedSlip: BenchPoint[];
  camberSweep: BenchPoint[];
  pressureSweep: BenchPoint[];
  temperatureSweep: BenchPoint[];
  loadSweep: BenchPoint[];
  relaxationStep: BenchPoint[];
  summary: Gt3TireBenchSummary;
}

export interface Gt3TireBenchSummary {
  peakLongitudinalMu: number;
  peakLateralMu: number;
  loadSensitivityMuDropPct: number;
  pressureWindowLossPct: number;
  hotWindowLossPct: number;
  relaxationTimeTo63PctS: number;
  overturningMomentAt3DegNm: number;
}

export interface Gt3PhysicsEnvelope {
  peakLongitudinalMu: readonly [number, number];
  peakLateralMu: readonly [number, number];
  loadSensitivityMuDropPct: readonly [number, number];
  pressureWindowLossPct: readonly [number, number];
  hotWindowLossPct: readonly [number, number];
  relaxationTimeTo63PctS: readonly [number, number];
  overturningMomentAt3DegNm: readonly [number, number];
}

export const GT3_RWD_SYNTHETIC_ENVELOPE: Gt3PhysicsEnvelope = {
  peakLongitudinalMu: [0.92, 1.12],
  peakLateralMu: [0.9, 1.12],
  loadSensitivityMuDropPct: [8, 20],
  pressureWindowLossPct: [5, 17],
  hotWindowLossPct: [35, 65],
  relaxationTimeTo63PctS: [0.015, 0.05],
  overturningMomentAt3DegNm: [-90, -15],
};

const DEG = Math.PI / 180;

function range(start: number, end: number, step: number): number[] {
  const out: number[] = [];
  for (let v = start; v <= end + step * 0.5; v += step) out.push(Number(v.toFixed(8)));
  return out;
}

function evaluate(
  dataset: VersionedTireDataset,
  axle: Pacejka56Axle,
  kappa: number,
  alphaRad: number,
  fz: number,
  muScale = 1,
) {
  return evaluatePacejka56Combined({
    kappa,
    alphaRad,
    fz,
    muScale,
    axle,
    params: resolveTireAxleParams(dataset, axle),
  });
}

function peakAbs(points: BenchPoint[], key: 'fx' | 'fy', fz: number): number {
  return points.reduce((best, p) => Math.max(best, Math.abs(p[key] ?? 0)), 0) / fz;
}

export function runGt3TireBench(
  dataset: VersionedTireDataset = GT3_RWD_SLICK_TIRE_DATASET,
): Gt3TireBenchResult {
  const fz0 = dataset.rear.fz0;
  const pureLongitudinal: BenchPoint[] = range(-0.24, 0.24, 0.02).map((kappa) => {
    const r = evaluate(dataset, 'rear', kappa, 0, fz0);
    return { x: kappa, fx: r.fx };
  });
  const pureLateral: BenchPoint[] = range(-14, 14, 1).map((alphaDeg) => {
    const r = evaluate(dataset, 'rear', 0, alphaDeg * DEG, fz0);
    return { x: alphaDeg, fy: r.fy };
  });
  const combinedSlip: BenchPoint[] = range(0, 0.24, 0.02).map((kappa) => {
    const r = evaluate(dataset, 'rear', kappa, 8 * DEG, fz0);
    return { x: kappa, fx: r.fx, fy: r.fy };
  });
  const camberSweep: BenchPoint[] = range(-4, 1, 0.5).map((camberDeg) => {
    const distribution = computeContactPatchPressureDistribution({
      camberRad: camberDeg * DEG,
      pressureKpa: dataset.pressure.optimalHotKpa,
      optimalPressureKpa: dataset.pressure.optimalHotKpa,
    });
    const r = evaluate(dataset, 'rear', 0, 6 * DEG, fz0, 1);
    return { x: camberDeg, fy: r.fy, mz: computeOverturningMomentNm(fz0, distribution) };
  });
  const pressureSweep: BenchPoint[] = range(160, 260, 10).map((pressureKpa) => {
    const muScale = tirePressureMu(pressureKpa, dataset.pressure.optimalHotKpa);
    const r = evaluate(dataset, 'rear', 0.12, 0, fz0, muScale);
    return { x: pressureKpa, fx: r.fx, muScale };
  });
  const temperatureSweep: BenchPoint[] = range(30, 150, 10).map((tempC) => {
    const muScale = tireTempMu(tempC);
    const r = evaluate(dataset, 'rear', 0, 7 * DEG, fz0, muScale);
    return { x: tempC, fy: r.fy, muScale };
  });
  const loadSweep: BenchPoint[] = range(1800, 6200, 400).map((fz) => {
    const r = evaluate(dataset, 'rear', 0.12, 0, fz);
    return { x: fz, fx: r.fx, muScale: Math.abs(r.fx) / fz };
  });

  let dynamic = 0;
  let timeTo63 = 0;
  const relaxationStep: BenchPoint[] = [];
  const target = 0.1;
  const contactSpeed = 18;
  const dt = 1 / 240;
  const relaxationM = computeLoadSensitiveRelaxationLength({
    baseLengthM: dataset.relaxation.longitudinalM,
    fz: fz0,
    fz0,
    mu: 1,
    pressureKpa: dataset.pressure.optimalHotKpa,
    optimalPressureKpa: dataset.pressure.optimalHotKpa,
    slipMagnitude: target,
  });
  for (let i = 0; i < 80; i++) {
    const t = i * dt;
    dynamic = stepRelaxedSlip({
      slipTarget: target,
      slipDynamic: dynamic,
      contactSpeed,
      relaxationLength: relaxationM,
      dt,
    });
    if (timeTo63 === 0 && dynamic >= target * 0.63) timeTo63 = t;
    relaxationStep.push({ x: Number(t.toFixed(5)), dynamic, relaxationM });
  }

  const peakLongitudinalMu = peakAbs(pureLongitudinal, 'fx', fz0);
  const peakLateralMu = peakAbs(pureLateral, 'fy', fz0);
  const lowLoadMu = Math.abs(loadSweep[0]?.fx ?? 0) / Math.max(1, loadSweep[0]?.x ?? 1);
  const highLoadMu = Math.abs(loadSweep[loadSweep.length - 1]?.fx ?? 0) / Math.max(1, loadSweep[loadSweep.length - 1]?.x ?? 1);
  const pressurePeak = Math.max(...pressureSweep.map((p) => Math.abs(p.fx ?? 0)));
  const pressureWorst = Math.min(...pressureSweep.map((p) => Math.abs(p.fx ?? 0)));
  const tempPeak = Math.max(...temperatureSweep.map((p) => Math.abs(p.fy ?? 0)));
  const tempWorst = Math.min(...temperatureSweep.map((p) => Math.abs(p.fy ?? 0)));
  const distributionAt3Deg = computeContactPatchPressureDistribution({
    camberRad: -3 * DEG,
    pressureKpa: dataset.pressure.optimalHotKpa,
    optimalPressureKpa: dataset.pressure.optimalHotKpa,
  });
  const summary: Gt3TireBenchSummary = {
    peakLongitudinalMu,
    peakLateralMu,
    loadSensitivityMuDropPct: (1 - highLoadMu / Math.max(1e-6, lowLoadMu)) * 100,
    pressureWindowLossPct: (1 - pressureWorst / Math.max(1e-6, pressurePeak)) * 100,
    hotWindowLossPct: (1 - tempWorst / Math.max(1e-6, tempPeak)) * 100,
    relaxationTimeTo63PctS: timeTo63,
    overturningMomentAt3DegNm: computeOverturningMomentNm(fz0, distributionAt3Deg),
  };

  // Ensure this helper is exercised in the same suite even though the summary
  // does not use its full curve yet.
  const slidingMu = computeSlidingGripScale({ slidingSpeedMps: 8 });
  combinedSlip.push({ x: 999, muScale: slidingMu });

  return {
    datasetId: dataset.metadata.id,
    datasetVersion: dataset.metadata.version,
    fingerprint: tireDatasetFingerprint(dataset),
    pureLongitudinal,
    pureLateral,
    combinedSlip,
    camberSweep,
    pressureSweep,
    temperatureSweep,
    loadSweep,
    relaxationStep,
    summary,
  };
}

export function validateGt3BenchEnvelope(
  summary: Gt3TireBenchSummary,
  envelope: Gt3PhysicsEnvelope = GT3_RWD_SYNTHETIC_ENVELOPE,
): string[] {
  const findings: string[] = [];
  for (const key of Object.keys(envelope) as Array<keyof Gt3PhysicsEnvelope>) {
    const [lo, hi] = envelope[key];
    const value = summary[key];
    if (value < lo || value > hi) {
      findings.push(`${key}=${value.toFixed(4)} outside [${lo}, ${hi}]`);
    }
  }
  return findings;
}
