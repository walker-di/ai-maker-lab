import { describe, expect, it } from 'bun:test';
import { RacingInput } from './input.js';

class FakeEventTarget {
  private readonly listeners = new Map<string, Set<(event: { key: string }) => void>>();

  addEventListener(type: string, listener: EventListener): void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener as unknown as (event: { key: string }) => void);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener as unknown as (event: { key: string }) => void);
  }

  keydown(key: string): void {
    for (const listener of this.listeners.get('keydown') ?? []) {
      listener({ key });
    }
  }

  keyup(key: string): void {
    for (const listener of this.listeners.get('keyup') ?? []) {
      listener({ key });
    }
  }
}

describe('RacingInput', () => {
  it('maps ArrowLeft to positive steering and ArrowRight to negative steering', () => {
    const input = new RacingInput({ activeRate: 20, centreRate: 20, counterRate: 20 });
    const target = new FakeEventTarget();
    input.attach(target as unknown as EventTarget);

    target.keydown('ArrowLeft');
    input.update(0.1, 0);
    expect(input.state.steerCmd).toBeGreaterThan(0);
    expect(input.state.steerSmoothed).toBeGreaterThan(0);

    target.keyup('ArrowLeft');
    target.keydown('ArrowRight');
    input.update(0.1, 0);
    expect(input.state.steerCmd).toBeLessThan(0);
    expect(input.state.steerSmoothed).toBeLessThan(0);
  });

  it('treats arrow keys and WASD steering as the same direction', () => {
    const arrowInput = new RacingInput({ activeRate: 20, centreRate: 20, counterRate: 20 });
    const wasdInput = new RacingInput({ activeRate: 20, centreRate: 20, counterRate: 20 });
    const arrowTarget = new FakeEventTarget();
    const wasdTarget = new FakeEventTarget();
    arrowInput.attach(arrowTarget as unknown as EventTarget);
    wasdInput.attach(wasdTarget as unknown as EventTarget);

    arrowTarget.keydown('ArrowLeft');
    wasdTarget.keydown('a');
    arrowInput.update(0.1, 0);
    wasdInput.update(0.1, 0);

    expect(arrowInput.state.steerCmd).toBeCloseTo(wasdInput.state.steerCmd, 8);
    expect(arrowInput.state.steerSmoothed).toBeCloseTo(wasdInput.state.steerSmoothed, 8);
  });

  it('cancels steering when left and right arrows are both held', () => {
    const input = new RacingInput({ activeRate: 20, centreRate: 20, counterRate: 20 });
    const target = new FakeEventTarget();
    input.attach(target as unknown as EventTarget);

    target.keydown('ArrowLeft');
    target.keydown('ArrowRight');
    input.update(0.1, 0);

    expect(input.state.steerCmd).toBe(0);
    expect(input.state.steerSmoothed).toBe(0);
  });

  it('uses the faster counterRate when the driver flips steer direction (catching a slide)', () => {
    // activeRate 2 rad/s vs counterRate 10 rad/s. With identical hold times,
    // an opposing-direction input must move steerCmd substantially faster
    // than a same-direction input.
    const opposing = new RacingInput({
      activeRate: 2,
      counterRate: 10,
      centreRate: 2,
    });
    const opposingTarget = new FakeEventTarget();
    opposing.attach(opposingTarget as unknown as EventTarget);

    // Build up positive steer command (left).
    opposingTarget.keydown('ArrowLeft');
    opposing.update(0.5, 0);
    const startCmd = opposing.state.steerCmd;
    expect(startCmd).toBeGreaterThan(0);

    // Flip to right (countersteer); for one short tick the counter rate
    // should drive steerCmd far more aggressively than the active rate.
    opposingTarget.keyup('ArrowLeft');
    opposingTarget.keydown('ArrowRight');
    opposing.update(0.1, 0);
    const counterStep = startCmd - opposing.state.steerCmd;

    // Reference: same delta but with counterRate equal to activeRate (no
    // boost). The opposing case should move at least 3x further per tick.
    const reference = new RacingInput({
      activeRate: 2,
      counterRate: 2,
      centreRate: 2,
    });
    const referenceTarget = new FakeEventTarget();
    reference.attach(referenceTarget as unknown as EventTarget);
    referenceTarget.keydown('ArrowLeft');
    reference.update(0.5, 0);
    const refStart = reference.state.steerCmd;
    referenceTarget.keyup('ArrowLeft');
    referenceTarget.keydown('ArrowRight');
    reference.update(0.1, 0);
    const refStep = refStart - reference.state.steerCmd;

    expect(counterStep).toBeGreaterThan(refStep * 3);
  });

  it('uses tire aligning feedback to self-centre faster when steering is released', () => {
    const baseline = new RacingInput({ activeRate: 2, counterRate: 2, centreRate: 1 });
    const assisted = new RacingInput({
      activeRate: 2,
      counterRate: 2,
      centreRate: 1,
      alignFeedback: () => -1,
    });
    baseline.state.steerCmd = 0.8;
    assisted.state.steerCmd = 0.8;

    baseline.update(0.1, 60);
    assisted.update(0.1, 60);

    expect(assisted.state.steerCmd).toBeLessThan(baseline.state.steerCmd);
    expect(assisted.state.steerCmd).toBeGreaterThanOrEqual(0);
  });
});
