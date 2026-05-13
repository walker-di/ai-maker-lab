/**
 * Match / session bookkeeping types. Sessions group lap results so the
 * persistence layer can reason about "best lap on track X with vehicle Y"
 * across multiple visits.
 */

export interface SectorTime {
  index: number;
  ms: number;
}

export interface RacingSession {
  id: string;
  trackId: string;
  vehicleId: string;
  startedAt: string;
  endedAt?: string;
}

export interface LapResult {
  id: string;
  sessionId: string;
  trackId: string;
  vehicleId: string;
  /** Lap time in milliseconds. */
  lapMs: number;
  sectors: ReadonlyArray<SectorTime>;
  /** ISO timestamp. */
  finishedAt: string;
}

export interface BestLapKey {
  trackId: string;
  vehicleId: string;
}
