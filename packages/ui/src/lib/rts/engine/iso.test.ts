import { describe, expect, test } from 'bun:test';
import { IsoProjection } from './iso.js';

describe('IsoProjection', () => {
  test('round-trips tile to iso to tile for integer tiles', () => {
    const projection = new IsoProjection({
      tileSize: { width: 64, height: 32 },
      altitudeStep: 16,
      originX: 0,
      originY: 0,
    });
    for (const tile of [
      { col: 0, row: 0 },
      { col: 4, row: 7 },
      { col: 12, row: 3 },
    ]) {
      const iso = projection.tileToIso(tile);
      const back = projection.isoToTile(iso);
      expect(back).toEqual(tile);
    }
  });

  test('subtracts altitude from screen y', () => {
    const projection = new IsoProjection({
      tileSize: { width: 64, height: 32 },
      altitudeStep: 16,
      originX: 0,
      originY: 0,
    });
    const ground = projection.tileToIso({ col: 2, row: 2 }, 0);
    const elevated = projection.tileToIso({ col: 2, row: 2 }, 2);
    expect(elevated.y).toBe(ground.y - 32);
  });
});
