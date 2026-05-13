import type { AiDifficulty } from '../types.js';

export type RtsMissionPhase = 'opening' | 'build-up' | 'defense' | 'victory' | 'defeat';
export type RtsMissionPressure = 'stable' | 'rising' | 'high' | 'critical';
export type RtsMissionWaveStatus = 'forming' | 'cooldown' | 'imminent' | 'inbound' | 'resolved';

/**
 * Tone controls how the HUD strip is colored/styled. Drives CSS data attributes
 * or class variants in the UI layer — the engine owns the semantic value.
 */
export type RtsMissionTone = 'calm' | 'warning' | 'danger' | 'success' | 'failure';

export interface RtsMissionEnemyActivity {
  factionId: string | null;
  activeCombatUnits: number;
  wavesLaunched: number;
  lastWaveSize: number | null;
  lastWaveAtMs: number | null;
  cadenceMs: number | null;
  countdownMs: number | null;
  status: RtsMissionWaveStatus;
  statusLabel: string;
}

/**
 * Full presentation-ready mission state. The engine computes every field so
 * the route/HUD can bind directly without local re-derivation.
 *
 * Field groups:
 * - Identity / lifecycle: `status`, `tone`, `phase`, `pressure`
 * - Objective strip: `objectiveTitle`, `objectiveDetail`, `directive`
 * - Pressure row: `pressureLabel`, `pressureDetail`
 * - Wave row: `waveLabel`, `waveDetail`
 * - Raw data: `elapsedMs`, `enemyActivity`
 */
export interface RtsMissionState {
  // --- lifecycle ---
  status: 'active' | 'victory' | 'defeat';
  tone: RtsMissionTone;
  phase: RtsMissionPhase;
  pressure: RtsMissionPressure;

  // --- objective strip ---
  objectiveTitle: string;
  objectiveDetail: string;
  directive: string;

  // --- pressure row ---
  pressureLabel: string;
  pressureDetail: string;

  // --- wave row ---
  waveLabel: string;
  waveDetail: string;

  // --- raw telemetry ---
  elapsedMs: number;
  enemyActivity: RtsMissionEnemyActivity;
}

const AI_WAVE_CADENCE_MS: Record<AiDifficulty, number> = {
  easy: 45_000,
  normal: 30_000,
  hard: 20_000,
};

export function getAiWaveCadenceMs(difficulty: AiDifficulty): number {
  return AI_WAVE_CADENCE_MS[difficulty];
}

// ---------------------------------------------------------------------------
// Pure derivation helpers — used by RtsEngine but exported so tests and the
// route can call them directly if needed.
// ---------------------------------------------------------------------------

export function missionToneFromPhaseAndPressure(
  phase: RtsMissionPhase,
  pressure: RtsMissionPressure,
): RtsMissionTone {
  if (phase === 'victory') return 'success';
  if (phase === 'defeat') return 'failure';
  if (pressure === 'critical') return 'danger';
  if (pressure === 'high') return 'warning';
  if (pressure === 'rising') return 'warning';
  return 'calm';
}

export function missionStatusFromPhase(phase: RtsMissionPhase): 'active' | 'victory' | 'defeat' {
  if (phase === 'victory') return 'victory';
  if (phase === 'defeat') return 'defeat';
  return 'active';
}

export function missionPressureFromScore(score: number): RtsMissionPressure {
  if (score >= 0.75) return 'critical';
  if (score >= 0.45) return 'high';
  if (score >= 0.2) return 'rising';
  return 'stable';
}

export function missionDirectiveFromPhase(phase: RtsMissionPhase): string {
  switch (phase) {
    case 'opening':  return 'Expand your economy and begin training combat forces before the first wave arrives.';
    case 'build-up': return 'Enemy forces are massing. Fortify the perimeter and queue combat units now.';
    case 'defense':  return 'Absorb the incoming wave, then push once their line thins.';
    case 'victory':  return 'Consolidate the perimeter and prepare for extraction.';
    case 'defeat':   return 'Stabilize the opening, absorb the first assault, then counterattack.';
  }
}

export function missionPressureDetailFromPhase(
  pressure: RtsMissionPressure,
  phase: RtsMissionPhase,
  wavesLaunched: number,
  waveIndex: number,
  waveSize: number | null,
  waveAgeMs: number | null,
): string {
  if (phase === 'victory') {
    return wavesLaunched > 0
      ? `Wave ${wavesLaunched} was the last coordinated push and has been destroyed.`
      : 'No enemy counterattack remains in the field.';
  }
  if (phase === 'defeat') {
    return waveSize != null
      ? `${waveSize} hostiles were committed in the decisive assault.`
      : 'The enemy maintained enough pressure to overrun your base.';
  }
  if (pressure === 'critical') {
    return waveIndex > 0
      ? `Wave ${waveIndex} is pressing your lines right now.`
      : 'Enemy contact is escalating near your base.';
  }
  if (pressure === 'high') {
    return waveAgeMs != null
      ? `Enemy units from wave ${waveIndex} are still active on the field.`
      : 'Hostile movement detected near the front.';
  }
  if (pressure === 'rising') {
    return waveIndex > 0
      ? `The camp is rebuilding after wave ${waveIndex}. Expect another push.`
      : 'Scout reports indicate enemy forces are massing beyond the ridge.';
  }
  return 'No full strike wave yet. Use the lull to expand and fortify.';
}

export function missionWaveLabelAndDetail(
  phase: RtsMissionPhase,
  wavesLaunched: number,
  lastWaveSize: number | null,
  waveAgeMs: number | null,
  enemyLosses?: number,
  friendlyLosses?: number,
): { waveLabel: string; waveDetail: string } {
  if (phase === 'victory') {
    return {
      waveLabel: wavesLaunched > 0 ? `Wave ${wavesLaunched} defeated` : 'No active wave',
      waveDetail: enemyLosses != null
        ? `${enemyLosses} enemy losses recorded during the operation.`
        : `Wave ${wavesLaunched} broken. Battlefield cleared.`,
    };
  }
  if (phase === 'defeat') {
    return {
      waveLabel: wavesLaunched > 0 ? `Wave ${wavesLaunched} decisive` : 'Wave data unavailable',
      waveDetail: friendlyLosses != null
        ? `${friendlyLosses} friendly losses recorded before collapse.`
        : 'Defense overrun.',
    };
  }

  const waveLabel = wavesLaunched > 0
    ? `Wave ${wavesLaunched} · ${lastWaveSize ?? 0} hostiles`
    : 'No enemy wave detected';

  let waveDetail: string;
  if (wavesLaunched === 0) {
    waveDetail = 'The enemy camp is still massing forces beyond the ridge.';
  } else if (waveAgeMs != null && waveAgeMs < 12_000) {
    waveDetail = `Wave ${wavesLaunched} made contact ${Math.max(1, Math.round(waveAgeMs / 1000))}s ago.`;
  } else {
    waveDetail = `Last contact from wave ${wavesLaunched} was ${Math.max(1, Math.round((waveAgeMs ?? 0) / 1000))}s ago.`;
  }

  return { waveLabel, waveDetail };
}
