/**
 * Normalized input state pushed into the engine each frame. Concrete editor
 * commands and gameplay bindings live in their respective downstream plans;
 * plan 01 only defines the structural shape.
 */
export interface InputState {
  /** Per-axis movement intent in [-1, 1]. */
  move: { x: number; y: number; z: number };
  /** Per-axis camera look delta in radians. */
  look: { yaw: number; pitch: number };
  /** Pressed action bits. Open string set so downstream plans can extend. */
  actions: ReadonlySet<string>;
}

export function createEmptyInputState(): InputState {
  return {
    move: { x: 0, y: 0, z: 0 },
    look: { yaw: 0, pitch: 0 },
    actions: new Set(),
  };
}

export interface InputSource {
  pollFixed(): InputState;
  dispose(): void;
}

/**
 * Test-only input source. Tests call `set()` to override the current state
 * before each fixed step.
 */
export class ScriptedInputSource implements InputSource {
  private state: InputState = createEmptyInputState();

  set(patch: Partial<{
    move: Partial<InputState['move']>;
    look: Partial<InputState['look']>;
    actions: Iterable<string>;
  }>): void {
    this.state = {
      move: { ...this.state.move, ...(patch.move ?? {}) },
      look: { ...this.state.look, ...(patch.look ?? {}) },
      actions: patch.actions ? new Set(patch.actions) : this.state.actions,
    };
  }

  pollFixed(): InputState {
    return this.state;
  }

  dispose(): void {}
}
