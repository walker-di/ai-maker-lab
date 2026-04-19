export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
  run: boolean;
  pause: boolean;
  attack: boolean;
}

export function createEmptyInputState(): InputState {
  return {
    left: false,
    right: false,
    up: false,
    down: false,
    jump: false,
    run: false,
    pause: false,
    attack: false,
  };
}

export interface InputSource {
  pollFixed(): InputState;
  dispose(): void;
}

const KEYBOARD_BINDINGS: Record<string, keyof InputState> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  KeyA: 'left',
  KeyD: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyZ: 'jump',
  Space: 'jump',
  KeyX: 'attack',
  ShiftLeft: 'run',
  ShiftRight: 'run',
  Escape: 'pause',
  KeyP: 'pause',
};

export class KeyboardSource implements InputSource {
  private readonly state = createEmptyInputState();
  private readonly down = new Set<string>();
  private readonly target: HTMLElement | Window;
  private readonly handleDown: (event: KeyboardEvent) => void;
  private readonly handleUp: (event: KeyboardEvent) => void;

  constructor(target: HTMLElement | Window = typeof window !== 'undefined' ? window : (undefined as unknown as Window)) {
    this.target = target;
    this.handleDown = (event) => {
      const action = KEYBOARD_BINDINGS[event.code];
      if (!action) return;
      this.down.add(event.code);
      this.state[action] = true;
      if (action !== 'pause') event.preventDefault?.();
    };
    this.handleUp = (event) => {
      const action = KEYBOARD_BINDINGS[event.code];
      if (!action) return;
      this.down.delete(event.code);
      // Only release if no other binding for the same action is still held.
      const stillHeld = Object.entries(KEYBOARD_BINDINGS).some(
        ([code, mappedAction]) => mappedAction === action && this.down.has(code),
      );
      if (!stillHeld) this.state[action] = false;
    };
    if (this.target && 'addEventListener' in this.target) {
      this.target.addEventListener('keydown', this.handleDown as EventListener);
      this.target.addEventListener('keyup', this.handleUp as EventListener);
    }
  }

  pollFixed(): InputState {
    return { ...this.state };
  }

  dispose(): void {
    if (this.target && 'removeEventListener' in this.target) {
      this.target.removeEventListener('keydown', this.handleDown as EventListener);
      this.target.removeEventListener('keyup', this.handleUp as EventListener);
    }
  }
}

export class GamepadSource implements InputSource {
  private readonly state = createEmptyInputState();
  pollFixed(): InputState {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return { ...this.state };
    const pads = navigator.getGamepads();
    const pad = pads.find((p) => p && p.connected) ?? null;
    if (!pad) return { ...this.state };
    const ax0 = pad.axes[0] ?? 0;
    const ax1 = pad.axes[1] ?? 0;
    this.state.left = ax0 < -0.5 || !!pad.buttons[14]?.pressed;
    this.state.right = ax0 > 0.5 || !!pad.buttons[15]?.pressed;
    this.state.up = ax1 < -0.5 || !!pad.buttons[12]?.pressed;
    this.state.down = ax1 > 0.5 || !!pad.buttons[13]?.pressed;
    this.state.jump = !!pad.buttons[0]?.pressed;
    this.state.attack = !!pad.buttons[2]?.pressed;
    this.state.run = !!pad.buttons[1]?.pressed || !!pad.buttons[5]?.pressed;
    this.state.pause = !!pad.buttons[9]?.pressed;
    return { ...this.state };
  }
  dispose(): void {}
}

export class CompositeInputSource implements InputSource {
  constructor(private readonly sources: InputSource[]) {}
  pollFixed(): InputState {
    const merged = createEmptyInputState();
    for (const source of this.sources) {
      const s = source.pollFixed();
      for (const key of Object.keys(merged) as (keyof InputState)[]) {
        if (s[key]) merged[key] = true;
      }
    }
    return merged;
  }
  dispose(): void {
    for (const source of this.sources) source.dispose();
  }
}

export class ScriptedInputSource implements InputSource {
  private current: InputState = createEmptyInputState();
  set(state: Partial<InputState>): void {
    this.current = { ...this.current, ...state };
  }
  pollFixed(): InputState {
    return { ...this.current };
  }
  dispose(): void {}
}
