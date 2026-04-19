/**
 * Sensor spec discriminated union.
 *
 * `SensorSystem` (plan 03) reads each sensor once per fixed step and writes the
 * computed value(s) into the agent's flat `observation: Float32Array`. The
 * `outputWidth(spec)` helper sums to the brain's input vector width.
 */

export type SensorSpec =
  | {
      kind: 'groundContact';
      id: string;
      segmentId: string;
      /** Cosine threshold for contact normal vs. world-up. */
      thresholdRadians?: number;
    }
  | {
      kind: 'jointAngle';
      id: string;
      jointId: string;
    }
  | {
      kind: 'jointAngularVelocity';
      id: string;
      jointId: string;
    }
  | {
      kind: 'imuOrientation';
      id: string;
      segmentId: string;
    }
  | {
      kind: 'imuAngularVelocity';
      id: string;
      segmentId: string;
    }
  | {
      kind: 'bodyVelocity';
      id: string;
      segmentId: string;
    }
  | {
      kind: 'voxelSightShort';
      id: string;
      segmentId: string;
      rayCount: number;
      halfFovRadians: number;
      maxDistance: number;
    }
  | {
      kind: 'proximityToFood';
      id: string;
      segmentId: string;
      maxDistance: number;
    };

export type SensorKind = SensorSpec['kind'];

/** Width (number of floats) the sensor writes per step. */
export function outputWidth(spec: SensorSpec): number {
  switch (spec.kind) {
    case 'groundContact':
      return 1;
    case 'jointAngle':
      return 1;
    case 'jointAngularVelocity':
      return 1;
    case 'imuOrientation':
      return 4;
    case 'imuAngularVelocity':
      return 3;
    case 'bodyVelocity':
      return 3;
    case 'voxelSightShort':
      return spec.rayCount;
    case 'proximityToFood':
      return 1;
    default: {
      const _exhaustive: never = spec;
      void _exhaustive;
      return 0;
    }
  }
}
