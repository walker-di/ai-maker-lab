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
    const input = new RacingInput({ activeRate: 20, centreRate: 20 });
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
    const arrowInput = new RacingInput({ activeRate: 20, centreRate: 20 });
    const wasdInput = new RacingInput({ activeRate: 20, centreRate: 20 });
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
    const input = new RacingInput({ activeRate: 20, centreRate: 20 });
    const target = new FakeEventTarget();
    input.attach(target as unknown as EventTarget);

    target.keydown('ArrowLeft');
    target.keydown('ArrowRight');
    input.update(0.1, 0);

    expect(input.state.steerCmd).toBe(0);
    expect(input.state.steerSmoothed).toBe(0);
  });
});
