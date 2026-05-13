/**
 * Camera rig with four modes:
 *
 *   - `chase`  — third-person trailing chase (default)
 *   - `hood`   — first-person above the bonnet
 *   - `far`    — wider third-person, lifted higher
 *   - `map`    — fixed top-down orbit centred on the track origin
 *
 * The smoothed chase camera lerps `camPos`/`camTarget` toward the desired
 * pose with horizon decoupling: we always pass `worldUp = (0, 1, 0)` for
 * `lookAt` so the horizon stays level even when the chassis pitches.
 *
 * Pure on its own — the Three.js renderer reads `camPos` / `camTarget` and
 * applies them to a `PerspectiveCamera`.
 */

import { Vector3 } from 'three';

export type CameraMode = 'chase' | 'hood' | 'far' | 'map';

export const CAMERA_MODES: readonly CameraMode[] = ['chase', 'hood', 'far', 'map'];

export interface CameraRigState {
  position: Vector3;
  target: Vector3;
  up: Vector3;
}

export interface CameraInputs {
  carPosition: Vector3;
  carForward: Vector3;
  dt: number;
  mode: CameraMode;
}

export class CameraRig {
  readonly state: CameraRigState = {
    position: new Vector3(0, 8, -8),
    target: new Vector3(0, 0, 0),
    up: new Vector3(0, 1, 0),
  };

  step(input: CameraInputs): void {
    const heading = new Vector3(input.carForward.x, 0, input.carForward.z);
    // Fallback heading uses the chassis forward convention (-Z) so the chase
    // camera lands behind the car at +Z when the chassis quaternion is
    // momentarily degenerate.
    if (heading.lengthSq() < 1e-6) heading.set(0, 0, -1);
    else heading.normalize();
    const worldUp = new Vector3(0, 1, 0);

    if (input.mode === 'map') {
      this.state.position.set(0, 220, 0.001);
      this.state.target.set(0, 0, 0);
      this.state.up.set(0, 0, -1);
      return;
    }

    const lookAt = input.carPosition.clone().addScaledVector(heading, 4);
    let desired: Vector3;
    if (input.mode === 'hood') {
      desired = input.carPosition.clone()
        .addScaledVector(heading, 0.6)
        .addScaledVector(worldUp, 1.4);
    } else if (input.mode === 'far') {
      desired = input.carPosition.clone()
        .addScaledVector(heading, -16)
        .addScaledVector(worldUp, 8);
    } else {
      // chase
      desired = input.carPosition.clone()
        .addScaledVector(heading, -7.5)
        .addScaledVector(worldUp, 3.5);
    }
    this.state.position.lerp(desired, Math.min(1, input.dt * 6));
    this.state.target.lerp(lookAt, Math.min(1, input.dt * 8));
    this.state.up.set(0, 1, 0);
  }
}
