import { describe, expect, test } from 'bun:test';

import { FixedStepLoop } from './fixed-step-loop.js';

describe('FixedStepLoop', () => {
  test('drives N steps for an integer multiple of stepDt', () => {
    const loop = new FixedStepLoop({ hz: 60 });
    let calls = 0;
    loop.tick((1 / 60) * 5, () => calls++);
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

  test('alpha advances within a step and resets after the step fires', () => {
    const loop = new FixedStepLoop({ hz: 60 });
    loop.tick(1 / 120, () => {});
    expect(loop.alpha()).toBeGreaterThan(0);
    expect(loop.alpha()).toBeLessThan(1);
    loop.tick(1 / 120, () => {});
    expect(loop.alpha()).toBeLessThan(0.001);
  });

  test('totalSteps tracks fixed step count across ticks', () => {
    const loop = new FixedStepLoop({ hz: 60 });
    loop.tick((1 / 60) * 3, () => {});
    expect(loop.totalSteps()).toBe(3);
    loop.reset();
    expect(loop.totalSteps()).toBe(0);
  });
});
