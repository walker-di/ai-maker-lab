/**
 * Engine event surface for the racing experiment. Mirrors the RTS pattern:
 * a strongly-typed map plus an emitter whose `on` returns an unsubscribe.
 * Page models translate engine events into HUD updates and transport
 * persistence calls.
 */

export interface TickPayload {
  /** Total simulation time elapsed (s). */
  simTime: number;
  /** Real wall-clock dt for this tick (s). */
  dt: number;
}

export interface LapStartedPayload {
  trackId: string;
  vehicleId: string;
  /** Wall-clock timestamp (ms) when the line was crossed. */
  startedAt: number;
}

export interface LapFinishedPayload {
  trackId: string;
  vehicleId: string;
  lapMs: number;
  sectors: ReadonlyArray<{ index: number; ms: number }>;
}

export interface WheelEventPayload {
  /** 0..3 wheel index (0=FL, 1=FR, 2=RL, 3=RR). */
  index: number;
  kind: 'lockup' | 'spinout' | 'curb' | 'gravel';
}

/**
 * M2 — Force feedback rack-force event, emitted every simulation step.
 *
 * `rackForce` is the device-independent normalized output in [-1, 1]; +1
 * represents a full-strength centering/resistance force for a left-turn input.
 * The frontend device adapter is the only consumer that multiplies this by a
 * physical torque magnitude.
 *
 * Diagnostic fields allow HUD debug panels and tests to inspect individual
 * pipeline stages without importing ffb.ts directly.
 *
 * Device APIs MUST NOT be called inside any handler of this event within
 * packages/ui/src/lib/racing/engine/ or packages/domain/src/**.
 */
export interface FfbRackForcePayload {
  /** Simulation time at which this payload was produced (s). */
  simTime: number;
  /**
   * Normalized rack force in [-1, 1].
   * Positive = resisting a left-turn input.
   */
  rackForce: number;
  /** KPI/SAI centering torque before assist shaping (Nm). */
  kpiTorqueNm: number;
  /** Aligning moment contribution from both front tires (Nm). */
  mzContributionNm: number;
  /** Fx scrub+caster coupling torque (Nm). */
  fxCouplingNm: number;
  /** Total raw torque before gain/clip (Nm). */
  totalRawNm: number;
  /** Power-steering assist scale this step (0..1). */
  assistScale: number;
}

export type EngineEventMap = {
  tick: TickPayload;
  lapStarted: LapStartedPayload;
  lapFinished: LapFinishedPayload;
  wheelEvent: WheelEventPayload;
  /** M2 — FFB rack-force output, emitted every simulation step. */
  ffbRackForce: FfbRackForcePayload;
};

type Listener<T> = (payload: T) => void;

export class EngineEmitter {
  private readonly listeners = new Map<keyof EngineEventMap, Set<Listener<unknown>>>();

  on<K extends keyof EngineEventMap>(type: K, listener: Listener<EngineEventMap[K]>): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener as Listener<unknown>);
    return () => set!.delete(listener as Listener<unknown>);
  }

  emit<K extends keyof EngineEventMap>(type: K, payload: EngineEventMap[K]): void {
    const set = this.listeners.get(type);
    if (!set) return;
    for (const listener of set) (listener as Listener<EngineEventMap[K]>)(payload);
  }

  removeAll(): void {
    this.listeners.clear();
  }
}
