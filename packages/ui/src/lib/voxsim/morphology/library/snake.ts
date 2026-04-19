import type { BodyDna, JointSpec, MotorSpec, SegmentSpec, SensorSpec } from '../types.js';

interface SnakeOptions {
  segments?: number;
  segmentLength?: number;
  segmentRadius?: number;
  totalMass?: number;
  id?: string;
}

const Q_ID = { x: 0, y: 0, z: 0, w: 1 };

export function createSnakeDna(opts: SnakeOptions = {}): BodyDna {
  const n = Math.max(2, opts.segments ?? 8);
  const segLen = opts.segmentLength ?? 0.20;
  const segR = opts.segmentRadius ?? 0.07;
  const totalMass = opts.totalMass ?? 5;
  const perSegMass = totalMass / n;

  const segments: SegmentSpec[] = [];
  const joints: JointSpec[] = [];
  const sensors: SensorSpec[] = [];
  const actuators: { id: string; range: { min: number; max: number }; mode: 'targetAngle' }[] = [];

  for (let i = 0; i < n; i++) {
    const seg: SegmentSpec = {
      id: `s${i}`, tag: `seg${i}`,
      shape: { kind: 'capsule', halfHeight: segLen * 0.5, radius: segR },
      mass: perSegMass,
      restPose: i === 0
        ? { position: { x: 0, y: segR + 0.05, z: 0 }, rotation: Q_ID }
        // Each successive segment offset along +z by one segment length.
        : { position: { x: 0, y: 0, z: segLen }, rotation: Q_ID },
      colorHint: i % 2 === 0 ? '#3a8c4a' : '#2d6e3a',
    };
    segments.push(seg);
  }

  for (let i = 1; i < n; i++) {
    const id = `j${i}`;
    const motor: MotorSpec = {
      mode: 'position', maxForce: 80, actuatorId: `${id}.angle`,
    };
    const joint: JointSpec = {
      kind: 'hinge', id,
      parentSegmentId: `s${i - 1}`,
      childSegmentId: `s${i}`,
      pivotOnParent: { x: 0, y: 0, z: segLen * 0.5 },
      axisOnParent: { x: 0, y: 1, z: 0 },
      minAngle: -0.5, maxAngle: 0.5,
      motor,
    };
    joints.push(joint);
    actuators.push({ id: `${id}.angle`, range: { min: -0.5, max: 0.5 }, mode: 'targetAngle' });
    sensors.push({ kind: 'jointAngle', id: `${id}.s`, jointId: id });
  }

  sensors.push({ kind: 'imuOrientation', id: 's0.imu', segmentId: 's0' });
  sensors.push({ kind: 'bodyVelocity', id: 's0.vel', segmentId: 's0' });

  return {
    id: opts.id ?? 'starter:snake',
    version: 1,
    kind: 'bioOrganism',
    rootSegmentId: 's0',
    segments,
    joints,
    sensors,
    actuators: { actuators },
    metadata: {
      name: 'Starter Snake',
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
      author: 'voxsim:library',
    },
  };
}
