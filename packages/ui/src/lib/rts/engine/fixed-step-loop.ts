/** Same accumulator pattern as the platformer engine, kept independent. */
export interface FixedStepLoopOptions {
  hz: number;
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
