/**
 * Keyboard input controller. Driver inputs:
 *   - WASD / Arrows: throttle, brake, steer left/right
 *   - Shift: handbrake
 *   - Q/E: shift down/up
 *
 * Steering is rate-limited and self-centres slightly slower than active
 * input (with caster-assist factored in) — the prototype's tuning lands on
 * `2.5 rad/s` active and `3.5 rad/s` self-centring with caster=0.
 */

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export interface RacingInputState {
  throttle: number;
  brake: number;
  steerCmd: number;
  steerSmoothed: number;
  handbrake: number;
  shiftUp: boolean;
  shiftDown: boolean;
}

export interface RacingInputOptions {
  /** Active steer rate (1/s). Default 2.5 — matches the prototype tuning. */
  activeRate?: number;
  /** Self-centre rate (1/s) with no caster assist. Default 3.5. */
  centreRate?: number;
  /** Caster degree from the runtime setup, used to scale self-centring. */
  casterDeg?: () => number;
}

export class RacingInput {
  readonly state: RacingInputState = {
    throttle: 0,
    brake: 0,
    steerCmd: 0,
    steerSmoothed: 0,
    handbrake: 0,
    shiftUp: false,
    shiftDown: false,
  };

  private readonly opts: Required<Omit<RacingInputOptions, 'casterDeg'>> & { casterDeg: () => number };
  private readonly keys = new Set<string>();
  private readonly onKeyDown: (e: KeyboardEvent) => void;
  private readonly onKeyUp: (e: KeyboardEvent) => void;
  private boundTarget: EventTarget | null = null;

  constructor(opts: RacingInputOptions = {}) {
    this.opts = {
      activeRate: opts.activeRate ?? 2.5,
      centreRate: opts.centreRate ?? 3.5,
      casterDeg: opts.casterDeg ?? (() => 0),
    };
    this.onKeyDown = (e) => {
      if (this.consumes(e.key)) {
        this.keys.add(e.key.toLowerCase());
        if (e.key === 'q') this.state.shiftDown = true;
        if (e.key === 'e') this.state.shiftUp = true;
      }
    };
    this.onKeyUp = (e) => {
      this.keys.delete(e.key.toLowerCase());
      if (e.key === 'q') this.state.shiftDown = false;
      if (e.key === 'e') this.state.shiftUp = false;
    };
  }

  attach(target: EventTarget = globalThis as unknown as EventTarget): void {
    this.detach();
    target.addEventListener('keydown', this.onKeyDown as EventListener);
    target.addEventListener('keyup', this.onKeyUp as EventListener);
    this.boundTarget = target;
  }

  detach(): void {
    if (!this.boundTarget) return;
    this.boundTarget.removeEventListener('keydown', this.onKeyDown as EventListener);
    this.boundTarget.removeEventListener('keyup', this.onKeyUp as EventListener);
    this.boundTarget = null;
    this.keys.clear();
  }

  /**
   * Step the input model forward. `dt` is the wall-clock delta in seconds.
   * Speed is the chassis speed in km/h; used by the steering smoother (which
   * is conceptually speed-sensitive but currently uses constant rates).
   */
  update(dt: number, _speedKmh: number): void {
    const k = this.keys;
    const throttle = (k.has('w') || k.has('arrowup')) ? 1 : 0;
    const brake = (k.has('s') || k.has('arrowdown')) ? 1 : 0;
    const steerInput =
      ((k.has('a') || k.has('arrowleft')) ? 1 : 0) -
      ((k.has('d') || k.has('arrowright')) ? 1 : 0);
    const handbrake = k.has('shift') ? 1 : 0;

    this.state.throttle = throttle;
    this.state.brake = brake;
    this.state.handbrake = handbrake;

    const target = steerInput;
    const rate = this.opts.activeRate * dt;
    const delta = clamp(target - this.state.steerCmd, -rate, rate);
    this.state.steerCmd = clamp(this.state.steerCmd + delta, -1, 1);

    if (target === 0) {
      const casterAssist = 1 + (this.opts.casterDeg() / 10) * 0.8;
      const r2 = this.opts.centreRate * casterAssist * dt;
      if (this.state.steerCmd > 0) this.state.steerCmd = Math.max(0, this.state.steerCmd - r2);
      else if (this.state.steerCmd < 0) this.state.steerCmd = Math.min(0, this.state.steerCmd + r2);
    }

    // Light smoothing for HUD readout / actuator feed.
    const smoothing = 1 - Math.exp(-dt * 18);
    this.state.steerSmoothed += (this.state.steerCmd - this.state.steerSmoothed) * smoothing;
  }

  private consumes(key: string): boolean {
    const k = key.toLowerCase();
    return ['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k);
  }
}
