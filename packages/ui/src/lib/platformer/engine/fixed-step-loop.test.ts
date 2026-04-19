import { describe, expect, test } from 'bun:test';
import { FixedStepLoop } from './fixed-step-loop.js';

describe('FixedStepLoop', () => {
  test('drives N steps for an integer multiple of stepDt', () => {
    const loop = new FixedStepLoop({ hz: 60 });
    let calls = 0;
    loop.tick(1 / 60 * 5, () => calls++);
    expect(calls).toBe(5);
  });

  test('clamps to maxStepsPerTick to avoid spiral of death', () => {
    const loop = new FixedStepLoop({ hz: 60, maxStepsPerTick: 3 });
    let calls = 0;
    loop.tick(1, () => calls++);
    expect(calls).toBe(3);
  });

  test('preserves leftover time between ticks', () => {
    const loop = new FixedStepLoop({ hz: 60 });
    let calls = 0;
    loop.tick(1 / 120, () => calls++);
    loop.tick(1 / 120, () => calls++);
    expect(calls).toBe(1);
  });
});
