import { describe, expect, test } from 'bun:test';
import { OrthoProjection } from './iso.js';

describe('OrthoProjection', () => {
  test('round-trips integer tiles through tileToScreen/screenToTile', () => {
    const projection = new OrthoProjection({
      tileSize: { width: 32, height: 32 },
      altitudeStep: 6,
      originX: 0,
      originY: 0,
    });
    for (const tile of [
      { col: 0, row: 0 },
      { col: 4, row: 7 },
      { col: 12, row: 3 },
    ]) {
      const screen = projection.tileToScreen(tile);
      const back = projection.screenToTile(screen);
      expect(back).toEqual(tile);
    }
  });

  test('higher altitude lifts the projected y by altitudeStep per level', () => {
    const projection = new OrthoProjection({
      tileSize: { width: 32, height: 32 },
      altitudeStep: 6,
      originX: 0,
      originY: 0,
    });
    const ground = projection.tileToScreen({ col: 2, row: 2 }, 0);
    const elevated = projection.tileToScreen({ col: 2, row: 2 }, 3);
    expect(elevated.x).toBe(ground.x);
    expect(elevated.y).toBe(ground.y - 18);
  });

  test('screenToTile recovers the source tile when given matching altitude', () => {
    const projection = new OrthoProjection({
      tileSize: { width: 32, height: 32 },
      altitudeStep: 6,
      originX: 100,
      originY: 50,
    });
    const tile = { col: 5, row: 9 };
    const altitude = 4;
    const screen = projection.tileToScreen(tile, altitude);
    expect(projection.screenToTile(screen, altitude)).toEqual(tile);
  });
});
