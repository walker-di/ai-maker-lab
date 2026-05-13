import { describe, expect, test } from 'bun:test';
import { sampleProjectileArc } from './projectile-arc.js';

describe('sampleProjectileArc', () => {
  test('direct projectile linearly interpolates altitude', () => {
    const p = sampleProjectileArc(
      { col: 0, row: 0, altitude: 0 },
      { col: 10, row: 0, altitude: 2 },
      0.5,
      'direct',
    );
    expect(p).toEqual({ col: 5, row: 0, altitude: 1 });
  });

  test('returns the endpoints exactly at progress bounds', () => {
    const from = { col: 1, row: 2, altitude: 3 };
    const to = { col: 7, row: 4, altitude: 5 };
    expect(sampleProjectileArc(from, to, 0, 'parabolic')).toEqual(from);
    expect(sampleProjectileArc(from, to, 1, 'parabolic')).toEqual(to);
  });

  test('parabolic projectile lifts over the linear path', () => {
    const direct = sampleProjectileArc(
      { col: 0, row: 0, altitude: 0 },
      { col: 10, row: 0, altitude: 0 },
      0.5,
      'direct',
    );
    const arc = sampleProjectileArc(
      { col: 0, row: 0, altitude: 0 },
      { col: 10, row: 0, altitude: 0 },
      0.5,
      'parabolic',
    );
    expect(arc.altitude).toBeGreaterThan(direct.altitude);
    expect(arc.altitude).toBeGreaterThan(0);
  });

  test('parabolic midpoint clears the higher endpoint altitude', () => {
    const arc = sampleProjectileArc(
      { col: 0, row: 0, altitude: 1 },
      { col: 10, row: 0, altitude: 2 },
      0.5,
      'parabolic',
    );
    expect(arc.altitude).toBeGreaterThan(2);
  });
});
