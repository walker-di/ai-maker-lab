import { describe, expect, test } from 'bun:test';
import { PlatformerEngine } from './PlatformerEngine.js';
import { ScriptedInputSource } from './input.js';
import { COMPONENT_KINDS } from './components.js';
import type { PositionComponent } from './components.js';
import type { MapDefinition, TileKind } from '../types.js';

function emptyTiles(cols: number, rows: number, fill: TileKind = 'empty'): TileKind[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => fill));
}

describe('PipeTeleportSystem (via PlatformerEngine)', () => {
  test('holding down on a linked pipeTop warps the player and emits pipeTeleport', () => {
    const cols = 24;
    const rows = 10;
    const tiles = emptyTiles(cols, rows);
    for (let c = 0; c < cols; c++) tiles[rows - 1]![c] = 'ground';
    // Standalone pipe cap (no pipe body above ground) so the player lands on `pipeTop`.
    tiles[rows - 1]![6] = 'pipeTop';

    const map: MapDefinition = {
      id: 'pipe-test',
      version: 1,
      size: { cols, rows },
      tileSize: 16,
      scrollMode: 'horizontal',
      spawn: { col: 6, row: rows - 2 },
      goal: { col: cols - 2, row: rows - 2, kind: 'flag' },
      tiles,
      entities: [],
      background: 'sky',
      music: 'overworld',
      pipeTeleports: [{ from: { col: 6, row: rows - 1 }, to: { col: 18, row: rows - 2 } }],
    };

    const engine = new PlatformerEngine({ mode: 'play' });
    const input = new ScriptedInputSource();
    engine.setInput(input);
    engine.loadMap(map);

    let teleportPayload: { from: { col: number; row: number }; to: { col: number; row: number } } | null = null;
    engine.on('pipeTeleport', (p) => { teleportPayload = p; });

    for (let i = 0; i < 80; i++) engine.tickFixed();
    input.set({ down: true });
    engine.tickFixed();

    const player = [...engine.world.query([COMPONENT_KINDS.playerState])][0]!;
    const pos = engine.world.getComponent<PositionComponent>(player, COMPONENT_KINDS.position)!;
    expect(teleportPayload).not.toBeNull();
    expect(teleportPayload!.to.col).toBe(18);
    expect(pos.x).toBeGreaterThan(16 * 12);
  });
});
