import { describe, expect, test } from 'bun:test';

import { motorsOf, type BodyDna } from '../types.js';
import { createBipedDna } from './biped.js';
import { createQuadrupedDna } from './quadruped.js';
import { createSnakeDna } from './snake.js';

/**
 * Pure structural checks. The full validator lives in
 * `packages/domain/src/shared/voxsim/morphology/validation.ts`. These tests
 * make sure the library factories do not produce dna with obvious wiring bugs;
 * the domain validator covers exhaustive cases.
 */
function assertStructurallyValid(dna: BodyDna): void {
  const segIds = new Set(dna.segments.map((s) => s.id));
  expect(segIds.has(dna.rootSegmentId)).toBe(true);

  const jointIds = new Set<string>();
  for (const j of dna.joints) {
    expect(segIds.has(j.parentSegmentId)).toBe(true);
    expect(segIds.has(j.childSegmentId)).toBe(true);
    expect(jointIds.has(j.id)).toBe(false);
    jointIds.add(j.id);
  }

  const actuatorIds = new Set(dna.actuators.actuators.map((a) => a.id));
  for (const j of dna.joints) {
    for (const m of motorsOf(j)) {
      expect(actuatorIds.has(m.actuatorId)).toBe(true);
    }
  }

  for (const s of dna.sensors) {
    if ('jointId' in s) expect(jointIds.has(s.jointId)).toBe(true);
    if ('segmentId' in s) expect(segIds.has(s.segmentId)).toBe(true);
  }

  // Tree connectivity from root.
  const childrenOf = new Map<string, string[]>();
  for (const j of dna.joints) {
    const arr = childrenOf.get(j.parentSegmentId) ?? [];
    arr.push(j.childSegmentId);
    childrenOf.set(j.parentSegmentId, arr);
  }
  const seen = new Set<string>([dna.rootSegmentId]);
  const stack = [dna.rootSegmentId];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    for (const c of childrenOf.get(cur) ?? []) {
      seen.add(c);
      stack.push(c);
    }
  }
  for (const s of dna.segments) expect(seen.has(s.id)).toBe(true);

  // Every segment has positive mass and dimensions.
  for (const s of dna.segments) {
    expect(s.mass).toBeGreaterThan(0);
    switch (s.shape.kind) {
      case 'box':
        expect(s.shape.halfExtents.x).toBeGreaterThan(0);
        expect(s.shape.halfExtents.y).toBeGreaterThan(0);
        expect(s.shape.halfExtents.z).toBeGreaterThan(0);
        break;
      case 'sphere':
        expect(s.shape.radius).toBeGreaterThan(0);
        break;
      case 'capsule':
        expect(s.shape.halfHeight).toBeGreaterThan(0);
        expect(s.shape.radius).toBeGreaterThan(0);
        break;
    }
  }
}

describe('starter morphology library', () => {
  test('createBipedDna is structurally valid', () => {
    assertStructurallyValid(createBipedDna());
  });

  test('createQuadrupedDna is structurally valid', () => {
    assertStructurallyValid(createQuadrupedDna());
  });

  test('createSnakeDna is structurally valid', () => {
    assertStructurallyValid(createSnakeDna());
  });
});
