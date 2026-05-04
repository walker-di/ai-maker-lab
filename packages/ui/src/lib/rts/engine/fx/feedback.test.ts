import { describe, expect, test } from 'bun:test';
import { RtsFeedbackController } from './feedback.js';

describe('RtsFeedbackController', () => {
  test('tracks and expires order ripples over time', () => {
    const feedback = new RtsFeedbackController();
    feedback.addOrderRipple({ col: 3, row: 4 }, 'move');

    let snapshot = feedback.read();
    expect(snapshot.ripples).toHaveLength(1);
    expect(snapshot.ripples[0]).toMatchObject({ tile: { col: 3, row: 4 }, kind: 'move', ageMs: 0, durationMs: 520 });

    feedback.step(200);
    snapshot = feedback.read();
    expect(snapshot.ripples).toHaveLength(1);
    expect(snapshot.ripples[0]!.ageMs).toBe(200);

    feedback.step(400);
    expect(feedback.read().ripples).toHaveLength(0);
  });

  test('clamps and decays combat heat', () => {
    const feedback = new RtsFeedbackController();
    feedback.addCombatHeat(0.8);
    feedback.addCombatHeat(0.8);
    expect(feedback.read().combatHeat).toBe(1);

    feedback.step(450);
    expect(feedback.read().combatHeat).toBeCloseTo(0.5, 5);
  });

  test('tracks hit-stop and camera shake until decay completes', () => {
    const feedback = new RtsFeedbackController();
    feedback.triggerHitStop(70, { x: 1, y: -0.5 });
    expect(feedback.isHitStopped()).toBe(true);
    expect(feedback.read().cameraShake).toEqual({ x: 5, y: -2.5 });

    feedback.step(35);
    expect(feedback.isHitStopped()).toBe(true);
    expect(feedback.read().hitStopMs).toBe(35);

    feedback.step(40);
    expect(feedback.isHitStopped()).toBe(false);
    expect(feedback.read().hitStopMs).toBe(0);
  });

  test('read returns snapshot copies rather than live references', () => {
    const feedback = new RtsFeedbackController();
    feedback.addOrderRipple({ col: 1, row: 2 }, 'repair');
    const snapshot = feedback.read();
    (snapshot.ripples as Array<{ tile: { col: number; row: number } }>)[0]!.tile.col = 99;

    expect(feedback.read().ripples[0]!.tile.col).toBe(1);
  });
});
