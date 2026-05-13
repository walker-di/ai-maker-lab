/**
 * Context-aware procedural prop placement around a track ribbon.
 *
 * Props are placed based on track geometry:
 *   - start/finish area   → flags, banners, radar, overhead, pit buildings
 *   - sharp corners        → barriers (outer), pylons (outer), cones (inner)
 *   - gentle curves        → barriers (outer)
 *   - long straights       → lights, grandstands, billboards, fences
 *
 * Not all props need to ship day-one; callers control counts via `SceneryHint`.
 */

import type { SampledPoint } from './catmull-rom.js';
import type { SceneryHint } from '../../types.js';

export type PropKind =
  | 'cone'
  | 'barrier'
  | 'light'
  | 'billboard'
  | 'flag'
  | 'fence'
  | 'grandStand'
  | 'pitBuilding'
  | 'pylon'
  | 'banner'
  | 'radar'
  | 'overhead';

export interface PropPlacement {
  kind: PropKind;
  x: number;
  y: number;
  z: number;
  rot: number;
}

export interface SceneryPlacementInput {
  centerline: ReadonlyArray<SampledPoint>;
  halfWidth: number;
  cadence: SceneryHint | undefined;
}

/** ------------------------------------------------------------------ */

function computeCurvature(centerline: ReadonlyArray<SampledPoint>): number[] {
  const L = centerline.length;
  const angles: number[] = [];
  for (let i = 0; i < L; i++) {
    const prev = centerline[(i - 1 + L) % L];
    const curr = centerline[i];
    const next = centerline[(i + 1) % L];
    const v1 = { x: curr.x - prev.x, z: curr.z - prev.z };
    const v2 = { x: next.x - curr.x, z: next.z - curr.z };
    const l1 = Math.hypot(v1.x, v1.z) || 1;
    const l2 = Math.hypot(v2.x, v2.z) || 1;
    const dot = (v1.x * v2.x + v1.z * v2.z) / (l1 * l2);
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
    angles.push(angle);
  }
  return angles;
}

function signedArea(centerline: ReadonlyArray<SampledPoint>): number {
  let sum = 0;
  const L = centerline.length;
  for (let i = 0; i < L; i++) {
    const a = centerline[i];
    const b = centerline[(i + 1) % L];
    sum += a.x * b.z - b.x * a.z;
  }
  return sum;
}

/** Normalised tangent at point i (central difference). */
function getSegmentTangent(
  centerline: ReadonlyArray<SampledPoint>,
  i: number,
): { x: number; z: number } {
  const L = centerline.length;
  const prev = centerline[(i - 1 + L) % L];
  const next = centerline[(i + 1) % L];
  const dx = next.x - prev.x;
  const dz = next.z - prev.z;
  const len = Math.hypot(dx, dz) || 1;
  return { x: dx / len, z: dz / len };
}

/**
 * Returns the unit normal pointing toward the OUTER side of the track.
 * CCW loop  → right-hand normal (tz, -tx).
 * CW  loop  → left-hand normal  (-tz, tx).
 */
function getOuterNormal(
  centerline: ReadonlyArray<SampledPoint>,
  i: number,
  ccw: boolean,
): { x: number; z: number } {
  const t = getSegmentTangent(centerline, i);
  return ccw ? { x: t.z, z: -t.x } : { x: -t.z, z: t.x };
}

type SegmentClass = 'straight' | 'gentle' | 'sharp';

interface StraightRun {
  start: number;
  length: number;
  indices: number[];
}

function classifySegments(angles: number[]) {
  const classifications: SegmentClass[] = [];
  const sharpIndices: number[] = [];
  const gentleIndices: number[] = [];
  const straightIndices: number[] = [];

  for (let i = 0; i < angles.length; i++) {
    const a = angles[i];
    if (a < 0.15) {
      classifications.push('straight');
      straightIndices.push(i);
    } else if (a < 0.4) {
      classifications.push('gentle');
      gentleIndices.push(i);
    } else {
      classifications.push('sharp');
      sharpIndices.push(i);
    }
  }
  return { classifications, sharpIndices, gentleIndices, straightIndices };
}

function extractStraightRuns(straightIndices: number[], L: number): StraightRun[] {
  if (straightIndices.length === 0) return [];
  const runs: StraightRun[] = [];
  let runStart = straightIndices[0];
  let runLength = 1;

  for (let k = 1; k <= straightIndices.length; k++) {
    const prev = straightIndices[k - 1];
    const curr = k < straightIndices.length ? straightIndices[k] : -1; // sentinel beyond end
    if (curr === (prev + 1) % L || curr === prev + 1) {
      runLength++;
    } else {
      const indices: number[] = [];
      for (let j = 0; j < runLength; j++) {
        indices.push((runStart + j) % L);
      }
      runs.push({ start: runStart, length: runLength, indices });
      if (k < straightIndices.length) {
        runStart = curr;
        runLength = 1;
      }
    }
  }
  return runs;
}

/** ------------------------------------------------------------------ */

export function placeScenery(input: SceneryPlacementInput): PropPlacement[] {
  if (!input.cadence) return [];

  const {
    cones = 0,
    barriers = 0,
    lights = 0,
    billboards = 0,
    flags = 0,
    fences = 0,
    grandStands = 0,
    pitBuildings = 0,
    pylons = 0,
    banners = 0,
    radars = 0,
    overheads = 0,
  } = input.cadence;

  const total =
    cones +
    barriers +
    lights +
    billboards +
    flags +
    fences +
    grandStands +
    pitBuildings +
    pylons +
    banners +
    radars +
    overheads;

  if (total <= 0 || input.centerline.length < 4) return [];

  const L = input.centerline.length;
  const { centerline, halfWidth } = input;

  // 1. Geometry analysis ------------------------------------------------
  const curvature = computeCurvature(centerline);
  const ccw = signedArea(centerline) > 0;

  const { sharpIndices, gentleIndices, straightIndices } =
    classifySegments(curvature);

  const straightRuns = extractStraightRuns(straightIndices, L);

  // Find local maxima of curvature (hills in the curvature array)
  const cornerCandidates: number[] = [];
  for (let i = 0; i < L; i++) {
    const prev = curvature[(i - 1 + L) % L];
    const curr = curvature[i];
    const next = curvature[(i + 1) % L];
    if (curr > prev && curr > next && curr > 0.05) {
      cornerCandidates.push(i);
    }
  }
  // Sort by curvature descending
  cornerCandidates.sort((a, b) => curvature[b] - curvature[a]);

  // Sort straight runs by length descending
  const longestStraights = [...straightRuns].sort(
    (a, b) => b.length - a.length,
  );

  const placements: PropPlacement[] = [];

  // Convenience closure for common placement shape
  function pushPlacement(
    kind: PropKind,
    index: number,
    side: 'outer' | 'inner',
    offset: number,
    y = 0,
  ) {
    const pt = centerline[index];
    const tan = getSegmentTangent(centerline, index);
    const nx = getOuterNormal(centerline, index, ccw);
    const sign = side === 'outer' ? 1 : -1;
    placements.push({
      kind,
      x: pt.x + nx.x * offset * sign,
      y,
      z: pt.z + nx.z * offset * sign,
      rot: Math.atan2(tan.x, tan.z),
    });
  }

  // 2. Start/finish area ------------------------------------------------

  // flag — index 0 (and mid-lap for extras)
  for (let i = 0; i < flags; i++) {
    const idx = i === 0 ? 0 : Math.floor(L / 2);
    pushPlacement('flag', idx, 'outer', halfWidth + 1.5);
  }

  // banner — indices 0, 1, 2
  for (let i = 0; i < banners; i++) {
    const idx = i % 3;
    pushPlacement('banner', idx, 'outer', halfWidth + 2.0);
  }

  // radar — near start/finish (index 2+)
  for (let i = 0; i < radars; i++) {
    const idx = (2 + i) % L;
    pushPlacement('radar', idx, 'outer', halfWidth + 2.5);
  }

  // overhead — start/finish gantry, elevated
  for (let i = 0; i < overheads; i++) {
    const idx = i % 3;
    pushPlacement('overhead', idx, 'outer', halfWidth + 1.0, 4.5);
  }

  // pitBuilding — inner side near index 0, spread 1-3
  for (let i = 0; i < pitBuildings; i++) {
    const idx = (1 + (i % 3)) % L;
    pushPlacement('pitBuilding', idx, 'inner', halfWidth + 3.0);
  }

  // 3. Corners ----------------------------------------------------------

  // pylon — local curvature maxima, outer edge
  for (let i = 0; i < Math.min(pylons, cornerCandidates.length); i++) {
    pushPlacement('pylon', cornerCandidates[i], 'outer', halfWidth + 1.0);
  }

  // barrier — sharp corners outer, gentle curves outer, then sharp inner
  let barriersRemaining = barriers;
  const barrierUsed = new Set<number>();

  for (const idx of cornerCandidates) {
    if (barriersRemaining <= 0) break;
    if (!barrierUsed.has(idx)) {
      pushPlacement('barrier', idx, 'outer', halfWidth + 0.8);
      barrierUsed.add(idx);
      barriersRemaining--;
    }
  }
  for (const idx of gentleIndices) {
    if (barriersRemaining <= 0) break;
    if (!barrierUsed.has(idx)) {
      pushPlacement('barrier', idx, 'outer', halfWidth + 0.8);
      barrierUsed.add(idx);
      barriersRemaining--;
    }
  }
  for (const idx of sharpIndices) {
    if (barriersRemaining <= 0) break;
    if (!barrierUsed.has(idx)) {
      pushPlacement('barrier', idx, 'inner', halfWidth + 0.8);
      barrierUsed.add(idx);
      barriersRemaining--;
    }
  }

  // cone — corner curvature maxima inner, then scattered on straights
  let conesRemaining = cones;
  const coneUsed = new Set<number>();
  for (const idx of cornerCandidates) {
    if (conesRemaining <= 0) break;
    if (!coneUsed.has(idx)) {
      pushPlacement('cone', idx, 'inner', halfWidth + 0.6);
      coneUsed.add(idx);
      conesRemaining--;
    }
  }
  if (conesRemaining > 0 && straightIndices.length > 0) {
    const stride = Math.max(1, Math.floor(straightIndices.length / conesRemaining));
    let s = 0;
    while (conesRemaining > 0 && s < straightIndices.length) {
      const idx = straightIndices[s];
      const pt = centerline[idx];
      const tan = getSegmentTangent(centerline, idx);
      const nx = getOuterNormal(centerline, idx, ccw);
      const sideSign = s % 2 === 0 ? 1 : -1;
      placements.push({
        kind: 'cone',
        x: pt.x + nx.x * (halfWidth + 1.2) * sideSign,
        y: 0,
        z: pt.z + nx.z * (halfWidth + 1.2) * sideSign,
        rot: Math.atan2(tan.x, tan.z),
      });
      conesRemaining--;
      s += stride;
    }
  }

  // 4. Straights --------------------------------------------------------

  // lights — evenly, primarily straights, alternating sides
  if (lights > 0) {
    let lightsRemaining = lights;
    const lightCandidates: number[] = [];
    for (const idx of straightIndices) lightCandidates.push(idx);
    if (lights > L / 10) {
      for (const idx of [...gentleIndices, ...sharpIndices]) {
        if (!lightCandidates.includes(idx)) lightCandidates.push(idx);
      }
    }
    for (let i = 0; i < lightCandidates.length && lightsRemaining > 0; i++) {
      const idx = lightCandidates[i];
      const pt = centerline[idx];
      const tan = getSegmentTangent(centerline, idx);
      const nx = getOuterNormal(centerline, idx, ccw);
      const sideSign = i % 2 === 0 ? 1 : -1;
      placements.push({
        kind: 'light',
        x: pt.x + nx.x * (halfWidth + 2.0) * sideSign,
        y: 0,
        z: pt.z + nx.z * (halfWidth + 2.0) * sideSign,
        rot: Math.atan2(tan.x, tan.z),
      });
      lightsRemaining--;
    }
    // Fallback: fill any remaining slots on unused indices
    for (let i = 0; i < L && lightsRemaining > 0; i++) {
      if (!lightCandidates.includes(i)) {
        const pt = centerline[i];
        const tan = getSegmentTangent(centerline, i);
        const nx = getOuterNormal(centerline, i, ccw);
        const sideSign = i % 2 === 0 ? 1 : -1;
        placements.push({
          kind: 'light',
          x: pt.x + nx.x * (halfWidth + 2.0) * sideSign,
          y: 0,
          z: pt.z + nx.z * (halfWidth + 2.0) * sideSign,
          rot: Math.atan2(tan.x, tan.z),
        });
        lightsRemaining--;
      }
    }
  }

  // fence — both sides, spaced tightly, respecting count
  if (fences > 0) {
    const perPoint = fences > L ? 2 : 1;
    const stride = Math.max(1, Math.floor(L * perPoint / fences));
    let placed = 0;
    for (let i = 0; i < L && placed < fences; i += stride) {
      const idx = i % L;
      const pt = centerline[idx];
      const tan = getSegmentTangent(centerline, idx);
      const nx = getOuterNormal(centerline, idx, ccw);
      // outer side
      placements.push({
        kind: 'fence',
        x: pt.x + nx.x * (halfWidth + 0.5),
        y: 0,
        z: pt.z + nx.z * (halfWidth + 0.5),
        rot: Math.atan2(tan.x, tan.z),
      });
      placed++;
      if (placed < fences && perPoint === 2) {
        // inner side
        placements.push({
          kind: 'fence',
          x: pt.x - nx.x * (halfWidth + 0.5),
          y: 0,
          z: pt.z - nx.z * (halfWidth + 0.5),
          rot: Math.atan2(tan.x, tan.z),
        });
        placed++;
      }
    }
  }

  // grandStand — outer side of longest straights, 3-5 consecutive points
  if (grandStands > 0) {
    let grandStandsRemaining = grandStands;
    for (let i = 0; i < longestStraights.length && grandStandsRemaining > 0; i++) {
      const run = longestStraights[i];
      const span = Math.min(5, run.length, 3 + (grandStandsRemaining > 0 ? 2 : 0));
      const mid = Math.floor(run.length / 2);
      for (let j = 0; j < span; j++) {
        const idx = (run.start + mid - Math.floor(span / 2) + j) % L;
        pushPlacement('grandStand', idx, 'outer', halfWidth + 4.0);
      }
      grandStandsRemaining--;
    }
  }

  // billboard — outer side of straights (not at start/finish)
  if (billboards > 0) {
    let billboardsRemaining = billboards;
    let candidates = straightIndices.filter((i) => i > 2);
    if (candidates.length === 0 && straightIndices.length > 0) {
      // Fallback if straight segments are very short or near start
      candidates = [...straightIndices];
    }
    const stride = Math.max(1, Math.floor(candidates.length / billboardsRemaining));
    for (let i = 0; i < candidates.length && billboardsRemaining > 0; i += stride) {
      const idx = candidates[i];
      pushPlacement('billboard', idx, 'outer', halfWidth + 2.5);
      billboardsRemaining--;
    }
  }

  return placements;
}
