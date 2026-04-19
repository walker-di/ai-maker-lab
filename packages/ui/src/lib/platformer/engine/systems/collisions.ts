import { COMPONENT_KINDS } from '../components.js';
import type {
  BodyComponent,
  EnemyAiComponent,
  ItemComponent,
  PlayerStateComponent,
  PositionComponent,
  ProjectileComponent,
  VelocityComponent,
} from '../components.js';
import type { System, EngineWorld, SystemContext, Entity } from '../world.js';
import type { Tunables } from '../tunables.js';
import { aabbIntersects } from '../aabb.js';

export interface CollisionOptions {
  tunables: Tunables;
  playerEntityRef: { value: Entity | null };
}

export class PlayerEntityCollisionSystem implements System {
  readonly name = 'player-entity-collision';
  constructor(private readonly opts: CollisionOptions) {}

  update(world: EngineWorld, _dt: number, ctx: SystemContext): void {
    const player = this.opts.playerEntityRef.value;
    if (player == null) return;
    const playerBody = world.getComponent<BodyComponent>(player, COMPONENT_KINDS.body);
    const playerVel = world.getComponent<VelocityComponent>(player, COMPONENT_KINDS.velocity);
    const playerState = world.getComponent<PlayerStateComponent>(player, COMPONENT_KINDS.playerState);
    if (!playerBody || !playerVel || !playerState) return;

    // Items
    for (const entity of world.query([COMPONENT_KINDS.item, COMPONENT_KINDS.body])) {
      if (!world.isAlive(entity)) continue;
      const itemBody = world.getComponent<BodyComponent>(entity, COMPONENT_KINDS.body)!;
      if (!aabbIntersects(playerBody.aabb, itemBody.aabb)) continue;
      const item = world.getComponent<ItemComponent>(entity, COMPONENT_KINDS.item)!;
      ctx.bus.emit({ type: 'itemPickup', player, entity, kind: item.kind });
      world.removeEntity(entity);
    }

    // Enemies
    for (const entity of world.query([COMPONENT_KINDS.enemyAi, COMPONENT_KINDS.body])) {
      const enemyAi = world.getComponent<EnemyAiComponent>(entity, COMPONENT_KINDS.enemyAi)!;
      if (enemyAi.deathState === 'gone') continue;
      const enemyBody = world.getComponent<BodyComponent>(entity, COMPONENT_KINDS.body)!;
      if (!aabbIntersects(playerBody.aabb, enemyBody.aabb)) continue;

      // Star kill
      if (playerState.starMs > 0) {
        enemyAi.deathState = 'gone';
        ctx.bus.emit({ type: 'enemyKilled', entity, by: 'star' });
        world.removeEntity(entity);
        continue;
      }

      // Stomp test for stompable enemies (walker, shell, flying)
      const stompable = enemyAi.kind === 'walkerEnemy' || enemyAi.kind === 'shellEnemy' || enemyAi.kind === 'flyingEnemy';
      const stomp = stompable && playerVel.vy > 0
        && playerBody.lastBottom <= enemyBody.aabb.y + 4;
      if (stomp) {
        if (enemyAi.kind === 'shellEnemy' && enemyAi.deathState === 'alive') {
          enemyAi.deathState = 'stomped';
        } else if (enemyAi.kind === 'shellEnemy' && enemyAi.deathState === 'stomped') {
          enemyAi.deathState = 'kicked';
          enemyAi.kickedSpeed = this.opts.tunables.shellSlideSpeed;
          enemyAi.dir = playerBody.aabb.x < enemyBody.aabb.x ? 1 : -1;
        } else {
          enemyAi.deathState = 'gone';
          world.removeEntity(entity);
        }
        playerVel.vy = -260;
        ctx.bus.emit({ type: 'enemyStomped', entity });
      } else {
        if (playerState.iframesMs > 0) continue;
        ctx.bus.emit({ type: 'playerHit', entity });
      }
    }

    // Projectiles vs enemies
    for (const projectile of world.query([COMPONENT_KINDS.projectile, COMPONENT_KINDS.body])) {
      const proj = world.getComponent<ProjectileComponent>(projectile, COMPONENT_KINDS.projectile)!;
      if (proj.source !== 'player') continue;
      const projBody = world.getComponent<BodyComponent>(projectile, COMPONENT_KINDS.body)!;
      for (const enemy of world.query([COMPONENT_KINDS.enemyAi, COMPONENT_KINDS.body])) {
        if (!world.isAlive(enemy)) continue;
        const eb = world.getComponent<BodyComponent>(enemy, COMPONENT_KINDS.body)!;
        const ai = world.getComponent<EnemyAiComponent>(enemy, COMPONENT_KINDS.enemyAi)!;
        if (ai.deathState === 'gone') continue;
        if (!aabbIntersects(projBody.aabb, eb.aabb)) continue;
        ai.deathState = 'gone';
        world.removeEntity(enemy);
        world.removeEntity(projectile);
        ctx.bus.emit({ type: 'enemyKilled', entity: enemy, by: 'fireball' });
        break;
      }
    }

    // Enemy projectiles vs player
    for (const projectile of world.query([COMPONENT_KINDS.projectile, COMPONENT_KINDS.body])) {
      const proj = world.getComponent<ProjectileComponent>(projectile, COMPONENT_KINDS.projectile)!;
      if (proj.source !== 'enemy') continue;
      const projBody = world.getComponent<BodyComponent>(projectile, COMPONENT_KINDS.body)!;
      if (!aabbIntersects(projBody.aabb, playerBody.aabb)) continue;
      world.removeEntity(projectile);
      if (playerState.starMs > 0) continue;
      if (playerState.iframesMs > 0) continue;
      ctx.bus.emit({ type: 'playerHit', entity: projectile });
    }

    void _dt;
  }
}
