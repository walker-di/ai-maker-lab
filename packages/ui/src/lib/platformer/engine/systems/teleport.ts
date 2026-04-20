import { COMPONENT_KINDS } from '../components.js';
import type { BodyComponent, PositionComponent, VelocityComponent } from '../components.js';
import type { System, EngineWorld } from '../world.js';
import type { MapDefinition } from '../../types.js';
import type { TileGrid } from '../tile-grid.js';
import type { AssetBundle } from '../assets.js';
import type { InputState } from '../input.js';

export interface PipeTeleportSystemOptions {
  grid: TileGrid;
  bundle: AssetBundle;
  getMap: () => MapDefinition | null;
  getInput: () => InputState;
  playerEntityRef: { value: number | null };
  onTeleport: (payload: { from: { col: number; row: number }; to: { col: number; row: number } }) => void;
}

/**
 * When the player is grounded on a `pipeTop` tile and holds **down**, warps to
 * the linked cell from `map.pipeTeleports` (if any).
 */
export class PipeTeleportSystem implements System {
  readonly name = 'pipe-teleport';

  constructor(private readonly opts: PipeTeleportSystemOptions) {}

  update(world: EngineWorld): void {
    const map = this.opts.getMap();
    const links = map?.pipeTeleports;
    if (!links?.length) return;
    if (!this.opts.getInput().down) return;

    const player = this.opts.playerEntityRef.value;
    if (player == null) return;

    const body = world.getComponent<BodyComponent>(player, COMPONENT_KINDS.body);
    const pos = world.getComponent<PositionComponent>(player, COMPONENT_KINDS.position);
    const vel = world.getComponent<VelocityComponent>(player, COMPONENT_KINDS.velocity);
    if (!body?.grounded || !pos || !vel) return;

    const ts = this.opts.grid.tileSize;
    const colC = Math.floor((body.aabb.x + body.aabb.width / 2) / ts);
    // Use lastBottom (post-integration footing) so we resolve the surface tile, not a body row slice.
    const rowFoot = Math.min(this.opts.grid.rows - 1, Math.floor(body.lastBottom / ts));
    if (!this.opts.grid.inBounds(colC, rowFoot)) return;
    if (this.opts.grid.tileAt(colC, rowFoot) !== 'pipeTop') return;

    const link = links.find((p) => p.from.col === colC && p.from.row === rowFoot);
    if (!link) return;

    const ph = this.opts.bundle.entities.player;
    const tx = link.to.col * ts + (ts - ph.width) / 2;
    const ty = link.to.row * ts + ts - ph.height;
    pos.x = tx;
    pos.y = ty;
    vel.vx = 0;
    vel.vy = 0;
    body.aabb.x = tx;
    body.aabb.y = ty;
    body.lastBottom = ty + ph.height;
    body.grounded = true;

    this.opts.onTeleport({ from: { col: colC, row: rowFoot }, to: { ...link.to } });
  }
}
