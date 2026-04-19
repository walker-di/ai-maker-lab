import { describe, expect, test } from 'bun:test';

import { identityQuat, identityTransform, vec3 } from './../vec.js';
import type { ActuatorMap } from './actuator-map.js';
import type { BodyDna, SegmentSpec } from './body-dna.js';
import type { JointSpec } from './joint-spec.js';
import type { SensorSpec } from './sensor-spec.js';
import { validateBodyDna } from './validation.js';

function makeSegment(id: string, mass = 1): SegmentSpec {
  return {
    id,
    tag: id,
    shape: { kind: 'box', halfExtents: vec3(0.5, 0.5, 0.5) },
    mass,
    restPose: identityTransform(),
  };
}

function makeBody(extra: Partial<BodyDna> = {}): BodyDna {
  const root = makeSegment('root');
  const child = makeSegment('child');
  const joint: JointSpec = {
    kind: 'hinge',
    id: 'j1',
    parentSegmentId: 'root',
    childSegmentId: 'child',
    pivotOnParent: vec3(0, 0, 0),
    axisOnParent: vec3(0, 0, 1),
    minAngle: -1,
    maxAngle: 1,
    motor: {
      mode: 'position',
      maxForce: 50,
      actuatorId: 'a1',
    },
  };
  const actuators: ActuatorMap = {
    actuators: [{ id: 'a1', range: { min: -1, max: 1 }, mode: 'targetAngle' }],
  };
  const sensor: SensorSpec = {
    kind: 'jointAngle',
    id: 's1',
    jointId: 'j1',
  };
  return {
    id: 'body-1',
    version: 1,
    kind: 'robot',
    rootSegmentId: 'root',
    segments: [root, child],
    joints: [joint],
    sensors: [sensor],
    actuators,
    metadata: {
      name: 'test',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      author: 'test',
    },
    ...extra,
  };
}

describe('validateBodyDna', () => {
  test('a minimal valid body passes', () => {
    const result = validateBodyDna(makeBody());
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('flags missing parent segment id', () => {
    const dna = makeBody({
      joints: [
        {
          kind: 'hinge',
          id: 'j1',
          parentSegmentId: 'nope',
          childSegmentId: 'child',
          pivotOnParent: vec3(0, 0, 0),
          axisOnParent: vec3(0, 0, 1),
          minAngle: -1,
          maxAngle: 1,
          motor: { mode: 'position', maxForce: 50, actuatorId: 'a1' },
        },
      ],
    });
    const result = validateBodyDna(dna);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'joint.parent-missing')).toBe(true);
  });

  test('flags missing child segment id', () => {
    const dna = makeBody({
      joints: [
        {
          kind: 'hinge',
          id: 'j1',
          parentSegmentId: 'root',
          childSegmentId: 'nope',
          pivotOnParent: vec3(0, 0, 0),
          axisOnParent: vec3(0, 0, 1),
          minAngle: -1,
          maxAngle: 1,
          motor: { mode: 'position', maxForce: 50, actuatorId: 'a1' },
        },
      ],
    });
    const result = validateBodyDna(dna);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'joint.child-missing')).toBe(true);
  });

  test('flags duplicate parent edges (graph not a tree)', () => {
    const dna = makeBody({
      segments: [makeSegment('root'), makeSegment('child')],
      joints: [
        {
          kind: 'hinge',
          id: 'j1',
          parentSegmentId: 'root',
          childSegmentId: 'child',
          pivotOnParent: vec3(0, 0, 0),
          axisOnParent: vec3(0, 0, 1),
          minAngle: -1,
          maxAngle: 1,
          motor: { mode: 'position', maxForce: 50, actuatorId: 'a1' },
        },
        {
          kind: 'fixed',
          id: 'j2',
          parentSegmentId: 'root',
          childSegmentId: 'child',
          transformOnParent: identityTransform(),
          transformOnChild: identityTransform(),
        },
      ],
    });
    const result = validateBodyDna(dna);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'joint.duplicate-parent')).toBe(true);
  });

  test('flags dangling motor actuatorId', () => {
    const dna = makeBody({
      joints: [
        {
          kind: 'hinge',
          id: 'j1',
          parentSegmentId: 'root',
          childSegmentId: 'child',
          pivotOnParent: vec3(0, 0, 0),
          axisOnParent: vec3(0, 0, 1),
          minAngle: -1,
          maxAngle: 1,
          motor: { mode: 'position', maxForce: 50, actuatorId: 'missing' },
        },
      ],
    });
    const result = validateBodyDna(dna);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'motor.actuator-id-missing')).toBe(true);
  });

  test('flags sensor referencing a missing joint', () => {
    const dna = makeBody({
      sensors: [{ kind: 'jointAngle', id: 's1', jointId: 'nope' }],
    });
    const result = validateBodyDna(dna);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'sensor.joint-missing')).toBe(true);
  });

  test('flags non-positive mass', () => {
    const dna = makeBody({
      segments: [makeSegment('root', 0), makeSegment('child')],
    });
    const result = validateBodyDna(dna);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'segment.mass-non-positive')).toBe(true);
  });

  test('flags inverted hinge angle limits', () => {
    const dna = makeBody({
      joints: [
        {
          kind: 'hinge',
          id: 'j1',
          parentSegmentId: 'root',
          childSegmentId: 'child',
          pivotOnParent: vec3(0, 0, 0),
          axisOnParent: vec3(0, 0, 1),
          minAngle: 1,
          maxAngle: -1,
          motor: { mode: 'position', maxForce: 50, actuatorId: 'a1' },
        },
      ],
    });
    const result = validateBodyDna(dna);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'joint.angle-limits-inverted')).toBe(true);
  });

  test('warns about unreferenced actuators', () => {
    const dna = makeBody({
      actuators: {
        actuators: [
          { id: 'a1', range: { min: -1, max: 1 }, mode: 'targetAngle' },
          { id: 'a2', range: { min: -1, max: 1 }, mode: 'targetAngle' },
        ],
      },
    });
    const result = validateBodyDna(dna);
    expect(result.ok).toBe(true);
    expect(result.warnings.some((w) => w.code === 'actuator.unreferenced')).toBe(true);
  });

  test('flags unreachable segments from root', () => {
    const dna = makeBody({
      segments: [makeSegment('root'), makeSegment('child'), makeSegment('orphan')],
    });
    void identityQuat();
    const result = validateBodyDna(dna);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'segment.unreachable-from-root')).toBe(true);
  });
});
