import { describe, expect, test } from 'bun:test';
import { RTS_ATLAS_FRAMES, RTS_ATLAS_URLS, getSpriteFrame } from './atlas.js';

const BUILDING_FRAME_EXPECTATIONS = [
  ['towersGrey', 'tower_15.png'],
  ['towersGrey', 'tower_00.png'],
  ['towersBrown', 'tower_15.png'],
  ['towersGrey', 'tower_07.png'],
  ['towersRed', 'tower_15.png'],
] as const;

describe('RTS atlas helpers', () => {
  test('atlas URLs point at the bundled RTS sprite sheets', () => {
    expect(Object.keys(RTS_ATLAS_URLS).sort()).toEqual([
      'landscape',
      'towersBrown',
      'towersGrey',
      'towersRed',
    ]);
    for (const url of Object.values(RTS_ATLAS_URLS)) {
      expect(url).toStartWith('/rts/towerDefense/Spritesheet/');
      expect(url).toEndWith('.png');
    }
  });

  test('returns known sprite frames and null for missing entries', () => {
    expect(getSpriteFrame('landscape', 'rocks_1.png')).toEqual({ x: 0, y: 0, w: 133, h: 99 });
    expect(getSpriteFrame('towersRed', 'tower_15.png')).toEqual({ x: 186, y: 306, w: 89, h: 74 });
    expect(getSpriteFrame('landscape', 'missing.png')).toBeNull();
  });

  test('includes all building frames used by the renderer', () => {
    for (const [sheet, frame] of BUILDING_FRAME_EXPECTATIONS) {
      expect(getSpriteFrame(sheet, frame)).not.toBeNull();
    }
  });

  test('does not duplicate frame names within a sheet', () => {
    for (const frameMap of Object.values(RTS_ATLAS_FRAMES)) {
      const frameNames = Object.keys(frameMap);
      expect(new Set(frameNames).size).toBe(frameNames.length);
    }
  });
});
