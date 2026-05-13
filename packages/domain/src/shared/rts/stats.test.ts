import { describe, expect, test } from 'bun:test';
import { BUILDING_STATS, TUNABLES, UNIT_STATS } from './stats.js';
import { BUILDING_KINDS, UNIT_KINDS } from './units.js';

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

  test('refinery and factory retain the expected parity capabilities', () => {
    expect(BUILDING_STATS.refinery.cost.mineral).toBeGreaterThan(0);
    expect(BUILDING_STATS.refinery.buildTimeMs).toBeGreaterThan(0);
    expect(BUILDING_STATS.refinery.footprint).toEqual({ cols: 2, rows: 2 });
    expect(BUILDING_STATS.factory.canTrain).toContain('rocket');
  });

  test('altitude tunables stay within sensible bounds', () => {
    expect(TUNABLES.altitudeRangeBonusPerLevel).toBeGreaterThan(0);
    expect(TUNABLES.altitudeDamageBonusPerLevel).toBeGreaterThan(0);
    expect(TUNABLES.lowerToHigherMissChance).toBeGreaterThan(0);
    expect(TUNABLES.lowerToHigherMissChance).toBeLessThan(1);
  });

  test('every unit and building kind has a matching stats entry', () => {
    for (const kind of UNIT_KINDS) {
      expect(UNIT_STATS[kind]).toBeDefined();
    }
    for (const kind of BUILDING_KINDS) {
      expect(BUILDING_STATS[kind]).toBeDefined();
    }
  });
});
