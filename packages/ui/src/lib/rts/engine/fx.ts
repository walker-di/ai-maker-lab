/**
 * Visual effects manager. Implements the spec's "low juice" toggle: when
 * `lowJuice` is `true`, particles, screen-shake and tweening are skipped.
 *
 * The renderer reads the queue every frame and clears effects after they
 * expire. Engine systems push effect descriptions; the renderer turns them
 * into Pixi sprites/filters when mounted.
 */
export type FxKind =
  | 'muzzle-flash'
  | 'impact'
  | 'death-puff'
  | 'gather-pop'
  | 'cash-pop'
  | 'placement-ring'
  | 'screen-shake';

export interface FxRequest {
  kind: FxKind;
  col?: number;
  row?: number;
  altitude?: number;
  amount?: number;
  factionId?: string;
  durationMs?: number;
}

export interface FxState extends FxRequest {
  id: number;
  startedAtMs: number;
}

export class FxManager {
  private nextId = 1;
  private active: FxState[] = [];
  constructor(public lowJuice = false) {}

  push(request: FxRequest, nowMs: number): void {
    if (this.lowJuice && request.kind === 'screen-shake') return;
    if (this.lowJuice && (request.kind === 'muzzle-flash' || request.kind === 'impact')) return;
    this.active.push({ ...request, id: this.nextId++, startedAtMs: nowMs, durationMs: request.durationMs ?? 250 });
  }

  tick(nowMs: number): void {
    this.active = this.active.filter((fx) => nowMs - fx.startedAtMs < (fx.durationMs ?? 250));
  }

  list(): readonly FxState[] {
    return this.active;
  }

  clear(): void {
    this.active = [];
  }
}
