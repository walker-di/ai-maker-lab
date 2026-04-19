/**
 * Fixed-step accumulator. Drives systems at a deterministic rate independent
 * of render frame timing. Tests can call `tick(dt)` directly without Pixi.
 */
export interface FixedStepLoopOptions {
  hz: number;
  /** Maximum fixed steps per `tick` call to avoid the spiral of death. */
  maxStepsPerTick?: number;
}

export class FixedStepLoop {
  readonly stepDt: number;
  private accumulator = 0;
  private readonly maxSteps: number;
  private fixedSteps = 0;

  constructor(options: FixedStepLoopOptions) {
    this.stepDt = 1 / options.hz;
    this.maxSteps = options.maxStepsPerTick ?? 5;
  }

  /**
   * Add real-time `dt` (seconds) and execute fixed-step callbacks until the
   * accumulator drains or the step cap is hit.
   *
   * Returns the number of fixed steps executed and an interpolation alpha for
   * smooth rendering.
   */
  tick(dt: number, step: () => void): { steps: number; alpha: number } {
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= this.stepDt && steps < this.maxSteps) {
      step();
      this.accumulator -= this.stepDt;
      steps++;
      this.fixedSteps++;
    }
    if (steps >= this.maxSteps && this.accumulator > this.stepDt) {
      // Drop excess time to avoid spiral.
      this.accumulator = 0;
    }
    return { steps, alpha: this.accumulator / this.stepDt };
  }

  reset(): void {
    this.accumulator = 0;
    this.fixedSteps = 0;
  }

  totalSteps(): number {
    return this.fixedSteps;
  }
}
