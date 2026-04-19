import type { BodyDna, JointSpec, MotorSpec, SegmentSpec, SensorSpec } from '../types.js';

interface BipedOptions {
  /** Total body mass in kg. Default 70. */
  mass?: number;
  /** Standing height in metres. Default 1.7. */
  height?: number;
  id?: string;
}

const ZERO = { x: 0, y: 0, z: 0 };
const Q_ID = { x: 0, y: 0, z: 0, w: 1 };

export function createBipedDna(opts: BipedOptions = {}): BodyDna {
  const mass = opts.mass ?? 70;
  const height = opts.height ?? 1.7;
  const torsoH = height * 0.30;
  const thighH = height * 0.24;
  const shinH = height * 0.22;
  const armH = height * 0.30;
  const limbR = height * 0.045;
  const headR = height * 0.06;

  const torso: SegmentSpec = {
    id: 'torso', tag: 'torso',
    shape: { kind: 'capsule', halfHeight: torsoH * 0.5, radius: limbR * 1.4 },
    mass: mass * 0.45,
    restPose: { position: { x: 0, y: shinH + thighH + torsoH * 0.5, z: 0 }, rotation: Q_ID },
    colorHint: '#5a78c8',
  };
  const head: SegmentSpec = {
    id: 'head', tag: 'head',
    shape: { kind: 'sphere', radius: headR },
    mass: mass * 0.06,
    restPose: { position: { x: 0, y: torsoH * 0.5 + headR, z: 0 }, rotation: Q_ID },
    colorHint: '#e0c39b',
  };
  const mkLeg = (side: 'left' | 'right'): SegmentSpec[] => {
    const sx = side === 'left' ? -limbR * 1.5 : limbR * 1.5;
    const thigh: SegmentSpec = {
      id: `${side}Thigh`, tag: `${side}Thigh`,
      shape: { kind: 'capsule', halfHeight: thighH * 0.5, radius: limbR },
      mass: mass * 0.10,
      restPose: { position: { x: sx, y: -torsoH * 0.5 - thighH * 0.5, z: 0 }, rotation: Q_ID },
      colorHint: '#8896b0',
    };
    const shin: SegmentSpec = {
      id: `${side}Shin`, tag: `${side}Shin`,
      shape: { kind: 'capsule', halfHeight: shinH * 0.5, radius: limbR * 0.9 },
      mass: mass * 0.06,
      restPose: { position: { x: 0, y: -thighH * 0.5 - shinH * 0.5, z: 0 }, rotation: Q_ID },
      colorHint: '#8896b0',
    };
    const foot: SegmentSpec = {
      id: `${side}Foot`, tag: `${side}Foot`,
      shape: { kind: 'box', halfExtents: { x: limbR * 1.5, y: limbR * 0.5, z: limbR * 3 } },
      mass: mass * 0.02,
      restPose: { position: { x: 0, y: -shinH * 0.5 - limbR * 0.5, z: limbR }, rotation: Q_ID },
      colorHint: '#3a3f50',
    };
    return [thigh, shin, foot];
  };
  const mkArm = (side: 'left' | 'right'): SegmentSpec[] => {
    const sx = side === 'left' ? -limbR * 2.5 : limbR * 2.5;
    const upper: SegmentSpec = {
      id: `${side}Upper`, tag: `${side}Upper`,
      shape: { kind: 'capsule', halfHeight: armH * 0.30, radius: limbR * 0.8 },
      mass: mass * 0.05,
      restPose: { position: { x: sx, y: torsoH * 0.4 - armH * 0.30, z: 0 }, rotation: Q_ID },
      colorHint: '#7c89a8',
    };
    const fore: SegmentSpec = {
      id: `${side}Fore`, tag: `${side}Fore`,
      shape: { kind: 'capsule', halfHeight: armH * 0.30, radius: limbR * 0.7 },
      mass: mass * 0.03,
      restPose: { position: { x: 0, y: -armH * 0.30 - armH * 0.30, z: 0 }, rotation: Q_ID },
      colorHint: '#7c89a8',
    };
    return [upper, fore];
  };

  const segments: SegmentSpec[] = [
    torso, head,
    ...mkLeg('left'), ...mkLeg('right'),
    ...mkArm('left'), ...mkArm('right'),
  ];

  const joints: JointSpec[] = [];
  const sensors: SensorSpec[] = [];
  const actuators: { id: string; range: { min: number; max: number }; mode: 'targetAngle' }[] = [];

  function addHinge(
    id: string, parent: string, child: string,
    pivot: { x: number; y: number; z: number },
    axis: { x: number; y: number; z: number },
    range: [number, number],
  ): void {
    const motor: MotorSpec = {
      mode: 'position', maxForce: 200, actuatorId: `${id}.angle`,
    };
    joints.push({
      kind: 'hinge', id, parentSegmentId: parent, childSegmentId: child,
      pivotOnParent: pivot, axisOnParent: axis,
      minAngle: range[0], maxAngle: range[1], motor,
    });
    actuators.push({ id: `${id}.angle`, range: { min: range[0], max: range[1] }, mode: 'targetAngle' });
    sensors.push({ kind: 'jointAngle', id: `${id}.s.angle`, jointId: id });
    sensors.push({ kind: 'jointAngularVelocity', id: `${id}.s.vel`, jointId: id });
  }

  function addSwingTwist(
    id: string, parent: string, child: string,
    position: { x: number; y: number; z: number },
  ): void {
    const motor: MotorSpec = {
      mode: 'position', maxForce: 250, actuatorId: `${id}.twist`,
    };
    joints.push({
      kind: 'swingTwist', id, parentSegmentId: parent, childSegmentId: child,
      positionOnParent: position,
      twistAxisOnParent: { x: 0, y: 1, z: 0 },
      planeAxisOnParent: { x: 1, y: 0, z: 0 },
      normalHalfConeAngle: 0.6,
      planeHalfConeAngle: 0.4,
      twistMinAngle: -0.4, twistMaxAngle: 0.4,
      motor,
    });
    actuators.push({ id: `${id}.twist`, range: { min: -0.4, max: 0.4 }, mode: 'targetAngle' });
    sensors.push({ kind: 'jointAngle', id: `${id}.s.angle`, jointId: id });
  }

  // Head pinned to torso (no actuator).
  joints.push({
    kind: 'fixed', id: 'neck', parentSegmentId: 'torso', childSegmentId: 'head',
    transformOnParent: { position: { x: 0, y: torsoH * 0.5, z: 0 }, rotation: Q_ID },
    transformOnChild: { position: { x: 0, y: -headR, z: 0 }, rotation: Q_ID },
  });

  // Hips: swingTwist for orientation freedom.
  addSwingTwist('leftHip', 'torso', 'leftThigh', { x: -limbR * 1.5, y: -torsoH * 0.5, z: 0 });
  addSwingTwist('rightHip', 'torso', 'rightThigh', { x: limbR * 1.5, y: -torsoH * 0.5, z: 0 });

  // Knees: hinge around side axis, range [0, 2.0] (no hyperextension).
  addHinge('leftKnee', 'leftThigh', 'leftShin', { x: 0, y: -thighH * 0.5, z: 0 }, { x: 1, y: 0, z: 0 }, [0, 2.0]);
  addHinge('rightKnee', 'rightThigh', 'rightShin', { x: 0, y: -thighH * 0.5, z: 0 }, { x: 1, y: 0, z: 0 }, [0, 2.0]);

  // Ankles: hinge for foot pitch.
  addHinge('leftAnkle', 'leftShin', 'leftFoot', { x: 0, y: -shinH * 0.5, z: 0 }, { x: 1, y: 0, z: 0 }, [-0.5, 0.5]);
  addHinge('rightAnkle', 'rightShin', 'rightFoot', { x: 0, y: -shinH * 0.5, z: 0 }, { x: 1, y: 0, z: 0 }, [-0.5, 0.5]);

  // Shoulders: swingTwist.
  addSwingTwist('leftShoulder', 'torso', 'leftUpper', { x: -limbR * 2.5, y: torsoH * 0.4, z: 0 });
  addSwingTwist('rightShoulder', 'torso', 'rightUpper', { x: limbR * 2.5, y: torsoH * 0.4, z: 0 });

  // Elbows: hinge.
  addHinge('leftElbow', 'leftUpper', 'leftFore', { x: 0, y: -armH * 0.30, z: 0 }, { x: 1, y: 0, z: 0 }, [0, 2.4]);
  addHinge('rightElbow', 'rightUpper', 'rightFore', { x: 0, y: -armH * 0.30, z: 0 }, { x: 1, y: 0, z: 0 }, [0, 2.4]);

  // Waist: a single hinge for spine flex.
  // Note: torso is the root segment; "waist" between torso parts isn't modelled
  // here because we only have one torso segment. We skip it intentionally.

  // Body sensors.
  sensors.push({ kind: 'imuOrientation', id: 'torso.imu', segmentId: 'torso' });
  sensors.push({ kind: 'imuAngularVelocity', id: 'torso.gyro', segmentId: 'torso' });
  sensors.push({ kind: 'bodyVelocity', id: 'torso.vel', segmentId: 'torso' });
  sensors.push({ kind: 'groundContact', id: 'leftFoot.gc', segmentId: 'leftFoot' });
  sensors.push({ kind: 'groundContact', id: 'rightFoot.gc', segmentId: 'rightFoot' });

  return {
    id: opts.id ?? 'starter:biped',
    version: 1,
    kind: 'robot',
    rootSegmentId: 'torso',
    segments,
    joints,
    sensors,
    actuators: { actuators },
    metadata: {
      name: 'Starter Biped',
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
      author: 'voxsim:library',
    },
  };
  void ZERO;
}
