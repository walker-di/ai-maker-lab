import type { BodyDna, JointSpec, MotorSpec, SegmentSpec, SensorSpec } from '../types.js';

interface QuadrupedOptions {
  mass?: number;
  bodyLength?: number;
  id?: string;
}

const Q_ID = { x: 0, y: 0, z: 0, w: 1 };

export function createQuadrupedDna(opts: QuadrupedOptions = {}): BodyDna {
  const mass = opts.mass ?? 30;
  const len = opts.bodyLength ?? 0.9;
  const limbR = 0.05;
  const upperH = 0.18;
  const lowerH = 0.18;

  const torso: SegmentSpec = {
    id: 'torso', tag: 'torso',
    shape: { kind: 'box', halfExtents: { x: 0.18, y: 0.10, z: len * 0.5 } },
    mass: mass * 0.55,
    restPose: { position: { x: 0, y: upperH + lowerH + 0.10, z: 0 }, rotation: Q_ID },
    colorHint: '#7d6a4a',
  };

  const segments: SegmentSpec[] = [torso];
  const joints: JointSpec[] = [];
  const sensors: SensorSpec[] = [];
  const actuators: { id: string; range: { min: number; max: number }; mode: 'targetAngle' }[] = [];

  function addLeg(prefix: string, sx: number, sz: number): void {
    const upper: SegmentSpec = {
      id: `${prefix}Upper`, tag: `${prefix}Upper`,
      shape: { kind: 'capsule', halfHeight: upperH * 0.5, radius: limbR },
      mass: mass * 0.05,
      restPose: { position: { x: sx, y: -0.10 - upperH * 0.5, z: sz }, rotation: Q_ID },
      colorHint: '#a89a7c',
    };
    const lower: SegmentSpec = {
      id: `${prefix}Lower`, tag: `${prefix}Lower`,
      shape: { kind: 'capsule', halfHeight: lowerH * 0.5, radius: limbR * 0.85 },
      mass: mass * 0.04,
      restPose: { position: { x: 0, y: -upperH * 0.5 - lowerH * 0.5, z: 0 }, rotation: Q_ID },
      colorHint: '#a89a7c',
    };
    const foot: SegmentSpec = {
      id: `${prefix}Foot`, tag: `${prefix}Foot`,
      shape: { kind: 'sphere', radius: limbR * 1.1 },
      mass: mass * 0.01,
      restPose: { position: { x: 0, y: -lowerH * 0.5 - limbR * 0.6, z: 0 }, rotation: Q_ID },
      colorHint: '#3a3f50',
    };
    segments.push(upper, lower, foot);

    const hipMotor: MotorSpec = { mode: 'position', maxForce: 200, actuatorId: `${prefix}Hip.twist` };
    joints.push({
      kind: 'swingTwist', id: `${prefix}Hip`,
      parentSegmentId: 'torso', childSegmentId: `${prefix}Upper`,
      positionOnParent: { x: sx, y: -0.10, z: sz },
      twistAxisOnParent: { x: 0, y: 1, z: 0 },
      planeAxisOnParent: { x: 1, y: 0, z: 0 },
      normalHalfConeAngle: 0.7,
      planeHalfConeAngle: 0.5,
      twistMinAngle: -0.4, twistMaxAngle: 0.4,
      motor: hipMotor,
    });
    actuators.push({ id: `${prefix}Hip.twist`, range: { min: -0.4, max: 0.4 }, mode: 'targetAngle' });
    sensors.push({ kind: 'jointAngle', id: `${prefix}Hip.s`, jointId: `${prefix}Hip` });

    const kneeMotor: MotorSpec = { mode: 'position', maxForce: 150, actuatorId: `${prefix}Knee.angle` };
    joints.push({
      kind: 'hinge', id: `${prefix}Knee`,
      parentSegmentId: `${prefix}Upper`, childSegmentId: `${prefix}Lower`,
      pivotOnParent: { x: 0, y: -upperH * 0.5, z: 0 },
      axisOnParent: { x: 1, y: 0, z: 0 },
      minAngle: 0, maxAngle: 2.0,
      motor: kneeMotor,
    });
    actuators.push({ id: `${prefix}Knee.angle`, range: { min: 0, max: 2.0 }, mode: 'targetAngle' });
    sensors.push({ kind: 'jointAngle', id: `${prefix}Knee.s`, jointId: `${prefix}Knee` });

    joints.push({
      kind: 'fixed', id: `${prefix}Ankle`,
      parentSegmentId: `${prefix}Lower`, childSegmentId: `${prefix}Foot`,
      transformOnParent: { position: { x: 0, y: -lowerH * 0.5, z: 0 }, rotation: Q_ID },
      transformOnChild: { position: { x: 0, y: limbR * 0.6, z: 0 }, rotation: Q_ID },
    });

    sensors.push({ kind: 'groundContact', id: `${prefix}Foot.gc`, segmentId: `${prefix}Foot` });
  }

  addLeg('fl', -0.16, -len * 0.4);
  addLeg('fr', 0.16, -len * 0.4);
  addLeg('bl', -0.16, len * 0.4);
  addLeg('br', 0.16, len * 0.4);

  sensors.push({ kind: 'imuOrientation', id: 'torso.imu', segmentId: 'torso' });
  sensors.push({ kind: 'imuAngularVelocity', id: 'torso.gyro', segmentId: 'torso' });
  sensors.push({ kind: 'bodyVelocity', id: 'torso.vel', segmentId: 'torso' });

  return {
    id: opts.id ?? 'starter:quadruped',
    version: 1,
    kind: 'bioOrganism',
    rootSegmentId: 'torso',
    segments,
    joints,
    sensors,
    actuators: { actuators },
    metadata: {
      name: 'Starter Quadruped',
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
      author: 'voxsim:library',
    },
  };
}
