import { describe, expect, test } from 'bun:test';
import { BUILDING_STATS, UNIT_STATS } from './stats.js';

describe('RTS stats', () => {
  test('scout is faster and sees farther than rifleman with lower damage', () => {
    expect(UNIT_STATS.scout.speed).toBeGreaterThan(UNIT_STATS.rifleman.speed);
    expect(UNIT_STATS.scout.sight).toBeGreaterThan(UNIT_STATS.rifleman.sight);
    expect(UNIT_STATS.scout.damage).toBeLessThan(UNIT_STATS.rifleman.damage);
  });

  test('rocket uses parabolic gas-costing attack profile', () => {
    expect(UNIT_STATS.rocket.cost.gas).toBeGreaterThan(0);
    expect(UNIT_STATS.rocket.arc).toBe('parabolic');
    expect(UNIT_STATS.rocket.projectileKind).toBe('rocket');
  });

  test('hq can train prototype parity units', () => {
    expect(BUILDING_STATS.hq.canTrain).toContain('worker');
    expect(BUILDING_STATS.hq.canTrain).toContain('scout');
    expect(BUILDING_STATS.hq.canTrain).toContain('rocket');
  });
});
