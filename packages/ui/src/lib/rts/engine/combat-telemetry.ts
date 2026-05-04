/**
 * Combat-readability telemetry for the RTS engine.
 *
 * Tracks:
 *  - Recent projectile/death impacts (impact log)
 *  - Active skirmish zones (clustered impact hot-spots)
 *  - Per-sector pressure levels (grid-bucketed threat intensity)
 *
 * All state is deterministic: no randomness, no async. Designed to be
 * polled each frame via `RtsEngine.getCombatSummary()` or consumed via the
 * `combatSummaryUpdated` event.
 *
 * Public surface used by the engine:
 *   - `CombatTelemetry` class (step / recordImpact / recordDeath)
 *   - `RtsCombatSummary` type
 *   - `RtsActiveSkirmish` type
 *   - `RtsSectorPressure` type
 *   - `RtsRecentImpact` type
 */

import type { TilePos } from '../types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Tile width/height of a pressure sector. 8×8 tiles per sector. */
export const SECTOR_SIZE = 8;

/** How many ms an impact stays in the log. */
export const IMPACT_MAX_AGE_MS = 12_000;

/** How many ms of inactivity before a skirmish is considered resolved. */
export const SKIRMISH_IDLE_TIMEOUT_MS = 8_000;

/** Max impacts kept in the log (oldest dropped first). */
export const IMPACT_LOG_MAX = 64;

/** Number of impacts within a skirmish radius in the last window needed to
 *  create / sustain an active skirmish entry. */
export const SKIRMISH_ACTIVATION_THRESHOLD = 3;

/** Tile radius within which impacts are merged into the same skirmish. */
export const SKIRMISH_MERGE_RADIUS = 6;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ImpactKind = 'bullet' | 'rocket' | 'tracer' | 'death' | 'building-death';

/** Severity mirrors the combatAlert event so consumers can use both. */
export type ImpactSeverity = 'warning' | 'danger';

export interface RtsRecentImpact {
  /** Monotonically increasing ID within this telemetry instance. */
  id: number;
  tile: TilePos;
  kind: ImpactKind;
  severity: ImpactSeverity;
  /** Faction whose assets were struck (local player = local faction id). */
  targetFactionId: string | undefined;
  /** Faction that fired, if tracked. */
  sourceFactionId: string | undefined;
  ageMs: number;
  /** Pre-computed sector key "col:row" (divided by SECTOR_SIZE). */
  sectorKey: string;
}

/**
 * A cluster of recent impacts around a tile centre, sustained while
 * impacts keep arriving within SKIRMISH_MERGE_RADIUS tiles.
 */
export interface RtsActiveSkirmish {
  id: number;
  /** Weighted-average centre tile, updated as impacts arrive. */
  centerTile: TilePos;
  /** How intense the skirmish is right now. */
  intensity: 'minor' | 'moderate' | 'heavy';
  /**
   * Whether the local player's assets are being hit in this zone.
   * Used by the HUD to colour the skirmish marker red vs. yellow.
   */
  localUnderFire: boolean;
  /** Number of impacts attributed to this skirmish in the activity window. */
  impactCount: number;
  /** Time since the last impact was attributed to this skirmish. */
  lastImpactAtMs: number;
  /** When the skirmish was first opened (for display purposes). */
  openedAtMs: number;
  ageMs: number;
}

export type SectorPressureLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

/**
 * Aggregate threat picture for one map sector (SECTOR_SIZE × SECTOR_SIZE tiles).
 */
export interface RtsSectorPressure {
  sectorKey: string;
  sectorCol: number;
  sectorRow: number;
  /** Centre tile of this sector in map space. */
  centerTile: TilePos;
  pressureLevel: SectorPressureLevel;
  /** Raw pressure score [0, 1]. */
  score: number;
  /** Number of recent impacts in this sector. */
  recentImpacts: number;
  /** True if the local faction has been hit in this sector recently. */
  localUnderFire: boolean;
}

/**
 * Compact, route-consumable summary of the current combat picture.
 * Polled via `engine.getCombatSummary()` or pushed via `combatSummaryUpdated`.
 */
export interface RtsCombatSummary {
  /** All impacts logged in the last IMPACT_MAX_AGE_MS. Ordered newest-first. */
  recentImpacts: readonly RtsRecentImpact[];
  /** Active skirmish zones, ordered by intensity desc then recency desc. */
  activeSkirmishes: readonly RtsActiveSkirmish[];
  /** Non-empty sectors with pressure > 'none', ordered score desc. */
  hotSectors: readonly RtsSectorPressure[];
  /** Aggregate combat heat [0, 1] — mirrors / extends feedback.combatHeat. */
  globalCombatHeat: number;
  /** True if the local player's base sector is under fire. */
  localBaseUnderFire: boolean;
  /** Count of all currently active (non-timed-out) skirmishes. */
  activeSkirmishCount: number;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

let nextImpactId = 1;
let nextSkirmishId = 1;

export class CombatTelemetry {
  private readonly impacts: RtsRecentImpact[] = [];
  private readonly skirmishes: Map<number, RtsActiveSkirmish & { _center: { col: number; row: number } }> = new Map();
  /** sector key → mutable pressure accumulator */
  private readonly sectorScores: Map<string, { score: number; localHits: number; impacts: number }> = new Map();
  private globalHeat = 0;
  private localFactionId: string;
  private localBaseSectorKey: string | null = null;
  private elapsedMs = 0;

  constructor(localFactionId: string) {
    this.localFactionId = localFactionId;
  }

  /** Set the local player's base tile so `localBaseUnderFire` can be computed. */
  setLocalBaseTile(tile: TilePos): void {
    this.localBaseSectorKey = sectorKey(tile);
  }

  /**
   * Advance time. Must be called once per fixed step with the step delta in ms.
   * Ages all tracked state and prunes expired entries.
   */
  step(dtMs: number): void {
    this.elapsedMs += dtMs;

    // Age + prune impacts
    for (const impact of this.impacts) impact.ageMs += dtMs;
    while (this.impacts.length > 0 && this.impacts[this.impacts.length - 1]!.ageMs >= IMPACT_MAX_AGE_MS) {
      this.impacts.pop();
    }
    if (this.impacts.length > IMPACT_LOG_MAX) {
      this.impacts.splice(IMPACT_LOG_MAX);
    }

    // Age skirmishes and prune timed-out ones
    for (const [id, sk] of this.skirmishes) {
      sk.ageMs += dtMs;
      if (this.elapsedMs - sk.lastImpactAtMs >= SKIRMISH_IDLE_TIMEOUT_MS) {
        this.skirmishes.delete(id);
      }
    }

    // Decay sector scores
    const decayFactor = Math.max(0, 1 - dtMs / 6_000);
    for (const [key, entry] of this.sectorScores) {
      entry.score *= decayFactor;
      if (entry.score < 0.01) {
        this.sectorScores.delete(key);
      }
    }

    // Decay global heat
    this.globalHeat = Math.max(0, this.globalHeat - dtMs / 900);
  }

  /**
   * Record a projectile impact or unit/building death.
   * Call this from `processEvents` whenever a combatAlert or death fires.
   */
  recordImpact(params: {
    tile: TilePos;
    kind: ImpactKind;
    severity: ImpactSeverity;
    targetFactionId: string | undefined;
    sourceFactionId: string | undefined;
    sourceEntityId?: number;
    targetEntityId?: number;
  }): { sectorKey: string; skirmishId: number | null } {
    const sk = sectorKey(params.tile);
    const isLocalHit = params.targetFactionId === this.localFactionId;

    const impact: RtsRecentImpact = {
      id: nextImpactId++,
      tile: { ...params.tile },
      kind: params.kind,
      severity: params.severity,
      targetFactionId: params.targetFactionId,
      sourceFactionId: params.sourceFactionId,
      ageMs: 0,
      sectorKey: sk,
    };

    // Prepend so index 0 = newest
    this.impacts.unshift(impact);
    if (this.impacts.length > IMPACT_LOG_MAX) this.impacts.pop();

    // Update sector pressure
    let sector = this.sectorScores.get(sk);
    if (!sector) {
      sector = { score: 0, localHits: 0, impacts: 0 };
      this.sectorScores.set(sk, sector);
    }
    const impactWeight = params.kind === 'building-death' ? 0.5
      : params.kind === 'death' ? 0.35
      : params.kind === 'rocket' ? 0.25
      : 0.12;
    sector.score = Math.min(1, sector.score + impactWeight);
    sector.impacts += 1;
    if (isLocalHit) sector.localHits += 1;

    // Update global heat
    this.globalHeat = Math.min(1, this.globalHeat + (params.kind === 'rocket' || params.kind === 'building-death' ? 0.45 : 0.18));

    // Merge into / open a skirmish
    const skirmishId = this.mergeOrOpenSkirmish(params.tile, isLocalHit);

    return { sectorKey: sk, skirmishId };
  }

  /** Read a snapshot of the current combat summary. */
  read(): RtsCombatSummary {
    const activeSkirmishes = [...this.skirmishes.values()]
      .filter((sk) => sk.impactCount >= SKIRMISH_ACTIVATION_THRESHOLD)
      .map((sk): RtsActiveSkirmish => ({
        id: sk.id,
        centerTile: { col: Math.round(sk._center.col), row: Math.round(sk._center.row) },
        intensity: sk.impactCount >= 12 ? 'heavy' : sk.impactCount >= 6 ? 'moderate' : 'minor',
        localUnderFire: sk.localUnderFire,
        impactCount: sk.impactCount,
        lastImpactAtMs: sk.lastImpactAtMs,
        openedAtMs: sk.openedAtMs,
        ageMs: sk.ageMs,
      }))
      .sort((a, b) =>
        intensityRank(b.intensity) - intensityRank(a.intensity) ||
        b.lastImpactAtMs - a.lastImpactAtMs,
      );

    const hotSectors = [...this.sectorScores.entries()]
      .filter(([, e]) => e.score >= 0.05)
      .map(([key, e]): RtsSectorPressure => {
        const [scol, srow] = key.split(':').map(Number) as [number, number];
        return {
          sectorKey: key,
          sectorCol: scol,
          sectorRow: srow,
          centerTile: {
            col: scol * SECTOR_SIZE + Math.floor(SECTOR_SIZE / 2),
            row: srow * SECTOR_SIZE + Math.floor(SECTOR_SIZE / 2),
          },
          pressureLevel: scoreToPressureLevel(e.score),
          score: e.score,
          recentImpacts: e.impacts,
          localUnderFire: e.localHits > 0,
        };
      })
      .sort((a, b) => b.score - a.score);

    const localBaseUnderFire = this.localBaseSectorKey != null
      ? (this.sectorScores.get(this.localBaseSectorKey)?.localHits ?? 0) > 0
      : false;

    return {
      recentImpacts: this.impacts.slice(),
      activeSkirmishes,
      hotSectors,
      globalCombatHeat: this.globalHeat,
      localBaseUnderFire,
      activeSkirmishCount: activeSkirmishes.length,
    };
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private mergeOrOpenSkirmish(tile: TilePos, localHit: boolean): number {
    const r2 = SKIRMISH_MERGE_RADIUS * SKIRMISH_MERGE_RADIUS;
    let nearest: (RtsActiveSkirmish & { _center: { col: number; row: number } }) | null = null;
    let nearestD2 = r2 + 1;

    for (const sk of this.skirmishes.values()) {
      const d2 = (sk._center.col - tile.col) ** 2 + (sk._center.row - tile.row) ** 2;
      if (d2 <= r2 && d2 < nearestD2) {
        nearestD2 = d2;
        nearest = sk;
      }
    }

    if (nearest) {
      // Weighted-average the centre toward new impact
      const w = 1 / (nearest.impactCount + 1);
      nearest._center.col += (tile.col - nearest._center.col) * w;
      nearest._center.row += (tile.row - nearest._center.row) * w;
      nearest.impactCount += 1;
      nearest.lastImpactAtMs = this.elapsedMs;
      if (localHit) nearest.localUnderFire = true;
      return nearest.id;
    }

    // Open new skirmish
    const id = nextSkirmishId++;
    this.skirmishes.set(id, {
      id,
      _center: { col: tile.col, row: tile.row },
      centerTile: { ...tile },
      intensity: 'minor',
      localUnderFire: localHit,
      impactCount: 1,
      lastImpactAtMs: this.elapsedMs,
      openedAtMs: this.elapsedMs,
      ageMs: 0,
    });
    return id;
  }
}

// ---------------------------------------------------------------------------
// Pure helpers (exported for tests)
// ---------------------------------------------------------------------------

export function sectorKey(tile: TilePos): string {
  return `${Math.floor(tile.col / SECTOR_SIZE)}:${Math.floor(tile.row / SECTOR_SIZE)}`;
}

export function scoreToPressureLevel(score: number): SectorPressureLevel {
  if (score >= 0.75) return 'critical';
  if (score >= 0.5) return 'high';
  if (score >= 0.25) return 'medium';
  if (score >= 0.05) return 'low';
  return 'none';
}

function intensityRank(intensity: RtsActiveSkirmish['intensity']): number {
  return intensity === 'heavy' ? 2 : intensity === 'moderate' ? 1 : 0;
}
