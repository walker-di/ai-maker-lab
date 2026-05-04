/**
 * Keyboard input controller. Driver inputs:
 *   - WASD / Arrows: throttle, brake, steer left/right
 *   - Shift: handbrake
 *   - Q/E: shift down/up
 *
 * Steering is rate-limited with three regimes: an active rate when the driver
 * pushes the input further in the current direction, a faster counter rate
 * when the driver flips sign (i.e. catching a slide with countersteer), and a
 * self-centring rate when input is released (assisted by tire aligning torque).
 *
 * Defaults: active 4.5 rad/s, counter 8.0 rad/s, self-centre 6.0 rad/s. The
 * counter rate matters most for drift recovery — a real driver moves the
 * wheel ~600–1000 deg/s when catching the rear, and 8 rad/s ≈ 460 deg/s
 * lands close enough on keyboard.
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
  /** Active steer rate (1/s) when pushing further in the same direction. Default 4.5. */
  activeRate?: number;
  /** Self-centre rate (1/s) with no caster assist. Default 6.0. */
  centreRate?: number;
  /** Counter steer rate (1/s) when the input flips sign (catching a slide). Default 8.0. */
  counterRate?: number;
  /** Normalized steering aligning feedback from the front tires, in [-1, 1]. */
  alignFeedback?: () => number;
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

  private readonly opts: Required<Omit<RacingInputOptions, 'alignFeedback'>> & { alignFeedback: () => number };
  private readonly keys = new Set<string>();
  private readonly onKeyDown: (e: KeyboardEvent) => void;
  private readonly onKeyUp: (e: KeyboardEvent) => void;
  private boundTarget: EventTarget | null = null;

  constructor(opts: RacingInputOptions = {}) {
    this.opts = {
      activeRate: opts.activeRate ?? 4.5,
      centreRate: opts.centreRate ?? 6.0,
      counterRate: opts.counterRate ?? 8.0,
      alignFeedback: opts.alignFeedback ?? (() => 0),
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
    // When the driver flips sign (e.g. arrow-right pressed while steerCmd is
    // still positive from a left input), use the faster counter rate so a
    // slide can actually be caught. Otherwise use the active rate.
    const opposing = target !== 0
      && this.state.steerCmd !== 0
      && Math.sign(target) !== Math.sign(this.state.steerCmd);
    const baseRate = opposing ? this.opts.counterRate : this.opts.activeRate;
    const rate = baseRate * dt;
    const delta = clamp(target - this.state.steerCmd, -rate, rate);
    this.state.steerCmd = clamp(this.state.steerCmd + delta, -1, 1);

    if (target === 0) {
      const align = clamp(this.opts.alignFeedback(), -1, 1);
      const baseStep = this.opts.centreRate * dt;
      const alignStep = Math.abs(align) * this.opts.centreRate * dt;
      if (this.state.steerCmd > 0) {
        const assist = align < 0 ? alignStep : 0;
        this.state.steerCmd = Math.max(0, this.state.steerCmd - baseStep - assist);
      } else if (this.state.steerCmd < 0) {
        const assist = align > 0 ? alignStep : 0;
        this.state.steerCmd = Math.min(0, this.state.steerCmd + baseStep + assist);
      }
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
