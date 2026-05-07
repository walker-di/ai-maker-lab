/**
 * FFB device output adapter — app-local, browser-safe.
 *
 * Consumes `ffbRackForce` events from `RacingEngine` and forwards the
 * normalized rack force to the Gamepad Haptics API when:
 *   1. The `ffb_v1` feature flag is enabled (stored in sessionStorage).
 *   2. A gamepad with haptic actuators is present.
 *
 * When no actuator is available (keyboard, no wheel connected) this adapter
 * is a no-op — the engine event is simply ignored.
 *
 * Architecture: this file is app-local (`apps/desktop-app/`). It MUST NOT be
 * imported from `packages/ui/src/lib/racing/engine/` or any domain package.
 */

import type { Racing } from 'ui/source';

type FfbRackForcePayload = Racing.Engine.FfbRackForcePayload;

/** Session-storage key for the opt-in flag. */
const FLAG_KEY = 'ffb_v1';

/** Physical force magnitude scale [0, 1] for the haptic actuator. */
const DEFAULT_PHYSICAL_GAIN = 1.0;

/** Minimal structural type for the engine event emitter — avoids importing the class. */
interface FfbEventEmitter {
  on(type: 'ffbRackForce', listener: (payload: FfbRackForcePayload) => void): () => void;
}

function isFlagEnabled(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  try {
    return sessionStorage.getItem(FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

/** Enable the FFB output for this browser session. */
export function enableFfbOutput(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(FLAG_KEY, '1');
  } catch {
    /* swallow quota errors */
  }
}

/** Disable the FFB output for this browser session. */
export function disableFfbOutput(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(FLAG_KEY);
  } catch {
    /* swallow quota errors */
  }
}

export function isFfbOutputEnabled(): boolean {
  return isFlagEnabled();
}

/**
 * Find the first gamepad with a `hapticActuators` array that contains at
 * least one actuator. Returns `null` when none is present.
 */
function findHapticGamepad(): Gamepad | null {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
  for (const gp of navigator.getGamepads()) {
    if (!gp) continue;
    const actuators = (gp as Gamepad & { hapticActuators?: unknown[] }).hapticActuators;
    if (Array.isArray(actuators) && actuators.length > 0) return gp;
  }
  return null;
}

/**
 * Play a constant-effect pulse on the first available haptic gamepad.
 * `intensity` is 0..1 (clamped). Duration is one frame (16 ms) so the effect
 * naturally decays if no new event arrives.
 */
function playHapticPulse(intensity: number): void {
  const gp = findHapticGamepad();
  if (!gp) return;
  const actuators = (gp as Gamepad & { hapticActuators?: GamepadHapticActuator[] }).hapticActuators;
  if (!Array.isArray(actuators) || actuators.length === 0) return;
  const actuator = actuators[0];
  if (!actuator) return;
  const clamped = Math.max(0, Math.min(1, intensity));
  // `pulse` is the baseline Gamepad API. Some browsers/drivers also support
  // `playEffect` — we prefer the simpler `pulse` here for maximum compat.
  if (typeof actuator.pulse === 'function') {
    void actuator.pulse(clamped, 16);
  }
}

/**
 * Attach an FFB output adapter to the given engine event emitter.
 *
 * Returns an `unsubscribe` function — call it when the engine is disposed.
 *
 * When the `ffb_v1` flag is not set or no haptic actuator is present, the
 * handler is still registered but produces no side effects, so the overhead is
 * one function call per simulation step.
 */
export function attachFfbOutputAdapter(
  events: FfbEventEmitter,
  physicalGain = DEFAULT_PHYSICAL_GAIN,
): () => void {
  return events.on('ffbRackForce', (payload) => {
    if (!isFlagEnabled()) return;
    const intensity = Math.abs(payload.rackForce) * Math.max(0, physicalGain);
    playHapticPulse(intensity);
  });
}
