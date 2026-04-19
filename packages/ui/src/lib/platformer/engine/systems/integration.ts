import { COMPONENT_KINDS } from '../components.js';
import type {
  BodyComponent,
  PlayerControlComponent,
  PositionComponent,
  VelocityComponent,
  RenderableComponent,
  ProjectileComponent,
} from '../components.js';
import type { System, EngineWorld } from '../world.js';
import type { TileGrid } from '../tile-grid.js';
import type { Tunables } from '../tunables.js';
import { sweepAABB } from '../physics.js';

export interface IntegrationOptions {
  grid: TileGrid;
  tunables: Tunables;
}

/**
 * Gravity, integration, and tile collision resolution. Runs after the player
 * controller and enemy AI have set desired velocities. Emits `bumpableHit`
 * and `hazardHit` events through the system bus.
 */
export class IntegrationSystem implements System {
  readonly name = 'integration';
  constructor(private readonly opts: IntegrationOptions) {}

  update(world: EngineWorld, dt: number, ctx: import('../world.js').SystemContext): void {
    const tun = this.opts.tunables;
    const grid = this.opts.grid;

    for (const entity of world.query([
      COMPONENT_KINDS.position,
      COMPONENT_KINDS.velocity,
      COMPONENT_KINDS.body,
    ])) {
      const pos = world.getComponent<PositionComponent>(entity, COMPONENT_KINDS.position)!;
      const vel = world.getComponent<VelocityComponent>(entity, COMPONENT_KINDS.velocity)!;
      const body = world.getComponent<BodyComponent>(entity, COMPONENT_KINDS.body)!;
      const ctrl = world.getComponent<PlayerControlComponent>(entity, COMPONENT_KINDS.playerControl);
      const projectile = world.getComponent<ProjectileComponent>(entity, COMPONENT_KINDS.projectile);

      // Gravity – player gets variable height; projectiles get their own.
      let gravity = tun.gravity;
      if (ctrl && ctrl.jumpHeld && vel.vy < 0) {
        gravity *= tun.jumpHoldGravityScale;
      }
      if (projectile) {
        gravity = tun.fireballGravity;
      }
      vel.vy = Math.min(vel.vy + gravity * dt, tun.maxFallSpeed);

      const prevBottom = body.lastBottom;
      const sweep = sweepAABB(
        body.aabb,
        vel.vx * dt,
        vel.vy * dt,
        prevBottom,
        grid,
      );

      pos.x = sweep.newX;
      pos.y = sweep.newY;
      body.aabb.x = sweep.newX;
      body.aabb.y = sweep.newY;
      body.lastBottom = sweep.newY + body.aabb.height;
      body.grounded = sweep.collidedY && vel.vy >= 0;
      body.ceilinged = sweep.bumpedHead;
      if (sweep.collidedY) {
        if (vel.vy > 0) vel.vy = 0;
        else if (sweep.bumpedHead) vel.vy = 0;
      }
      if (sweep.collidedX) vel.vx = 0;

      for (const e of sweep.events) {
        if (e.type === 'tile-bumped') {
          ctx.bus.emit({ type: 'bumpableHit', entity, col: e.col, row: e.row, kind: e.kind });
        } else if (e.type === 'hazard') {
          ctx.bus.emit({ type: 'hazardHit', entity, col: e.col, row: e.row });
        }
      }

      const renderable = world.getComponent<RenderableComponent>(entity, COMPONENT_KINDS.renderable);
      void renderable; // The render layer reads pos + body each frame.
    }
  }
}
