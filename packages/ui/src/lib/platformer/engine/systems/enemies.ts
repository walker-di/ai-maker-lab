import { COMPONENT_KINDS } from '../components.js';
import type {
  BodyComponent,
  EnemyAiComponent,
  FireBarComponent,
  BulletShooterComponent,
  PositionComponent,
  RenderableComponent,
  VelocityComponent,
} from '../components.js';
import type { System, EngineWorld } from '../world.js';
import type { TileGrid } from '../tile-grid.js';
import type { Tunables } from '../tunables.js';
import type { AssetBundle } from '../assets.js';

export interface EnemyOptions {
  grid: TileGrid;
  tunables: Tunables;
  bundle: AssetBundle;
}

export class WalkerEnemySystem implements System {
  readonly name = 'walker-enemy';
  constructor(private readonly opts: EnemyOptions) {}
  update(world: EngineWorld, dt: number): void {
    const grid = this.opts.grid;
    const ts = grid.tileSize;
    for (const entity of world.query([COMPONENT_KINDS.enemyAi, COMPONENT_KINDS.velocity, COMPONENT_KINDS.body])) {
      const ai = world.getComponent<EnemyAiComponent>(entity, COMPONENT_KINDS.enemyAi)!;
      if (ai.kind !== 'walkerEnemy' && ai.kind !== 'shellEnemy') continue;
      if (ai.deathState === 'gone') continue;
      const vel = world.getComponent<VelocityComponent>(entity, COMPONENT_KINDS.velocity)!;
      const body = world.getComponent<BodyComponent>(entity, COMPONENT_KINDS.body)!;

      const speed = ai.deathState === 'kicked'
        ? (ai.kickedSpeed ?? this.opts.tunables.shellSlideSpeed)
        : ai.patrol.speed;
      vel.vx = ai.dir * speed;

      // Wall flip
      const aheadX = ai.dir > 0 ? body.aabb.x + body.aabb.width + 1 : body.aabb.x - 1;
      const midY = body.aabb.y + body.aabb.height / 2;
      const aheadCol = Math.floor(aheadX / ts);
      const midRow = Math.floor(midY / ts);
      if (grid.solidAt(aheadCol, midRow)) {
        ai.dir = -ai.dir as -1 | 1;
      } else if (ai.patrol.edgeAware && body.grounded && ai.deathState === 'alive') {
        const footRow = Math.floor((body.aabb.y + body.aabb.height + 2) / ts);
        const footCol = Math.floor((ai.dir > 0 ? body.aabb.x + body.aabb.width : body.aabb.x) / ts);
        if (!grid.solidAt(footCol, footRow)) {
          ai.dir = -ai.dir as -1 | 1;
        }
      }
      if (ai.deathState === 'stomped') vel.vx = 0;
    }
  }
}

export class FlyingEnemySystem implements System {
  readonly name = 'flying-enemy';
  private t = 0;
  constructor(private readonly opts: EnemyOptions) {}
  update(world: EngineWorld, dt: number): void {
    this.t += dt;
    for (const entity of world.query([COMPONENT_KINDS.enemyAi, COMPONENT_KINDS.velocity])) {
      const ai = world.getComponent<EnemyAiComponent>(entity, COMPONENT_KINDS.enemyAi)!;
      if (ai.kind !== 'flyingEnemy') continue;
      if (ai.deathState !== 'alive') continue;
      const vel = world.getComponent<VelocityComponent>(entity, COMPONENT_KINDS.velocity)!;
      vel.vx = ai.dir * ai.patrol.speed;
      vel.vy = Math.sin(this.t * 2) * 90;
    }
  }
}

export class FireBarSystem implements System {
  readonly name = 'fire-bar';
  constructor(private readonly opts: EnemyOptions) {}
  update(world: EngineWorld, dt: number): void {
    const ts = this.opts.grid.tileSize;
    for (const entity of world.query([COMPONENT_KINDS.fireBar, COMPONENT_KINDS.position])) {
      const bar = world.getComponent<FireBarComponent>(entity, COMPONENT_KINDS.fireBar)!;
      bar.angle += bar.angularSpeed * dt;
      const pos = world.getComponent<PositionComponent>(entity, COMPONENT_KINDS.position)!;
      const cx = bar.anchorCol * ts + ts / 2;
      const cy = bar.anchorRow * ts + ts / 2;
      pos.x = cx + Math.cos(bar.angle) * bar.radiusPerSegment * (bar.segments - 1);
      pos.y = cy + Math.sin(bar.angle) * bar.radiusPerSegment * (bar.segments - 1);
      const body = world.getComponent<BodyComponent>(entity, COMPONENT_KINDS.body);
      if (body) {
        body.aabb.x = pos.x - body.aabb.width / 2;
        body.aabb.y = pos.y - body.aabb.height / 2;
      }
    }
  }
}

export class BulletShooterSystem implements System {
  readonly name = 'bullet-shooter';
  constructor(private readonly opts: EnemyOptions, private readonly spawnBullet: (x: number, y: number, vx: number) => void) {}
  update(world: EngineWorld, dt: number, ctx: import('../world.js').SystemContext): void {
    const dtMs = dt * 1000;
    for (const entity of world.query([COMPONENT_KINDS.bulletShooter, COMPONENT_KINDS.position])) {
      const shooter = world.getComponent<BulletShooterComponent>(entity, COMPONENT_KINDS.bulletShooter)!;
      shooter.elapsedMs += dtMs;
      if (shooter.elapsedMs >= shooter.cadenceMs) {
        shooter.elapsedMs = 0;
        const pos = world.getComponent<PositionComponent>(entity, COMPONENT_KINDS.position)!;
        const renderable = world.getComponent<RenderableComponent>(entity, COMPONENT_KINDS.renderable);
        const ox = renderable ? renderable.width / 2 : 7;
        const oy = renderable ? renderable.height / 2 : 8;
        this.spawnBullet(pos.x + ox, pos.y + oy, shooter.facing * shooter.bulletSpeed);
        ctx.bus.emit({ type: 'bulletSpawned', entity });
      }
    }
  }
}
