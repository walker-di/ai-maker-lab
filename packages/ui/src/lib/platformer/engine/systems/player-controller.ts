import type {
  BodyComponent,
  PlayerControlComponent,
  PlayerStateComponent,
  VelocityComponent,
  PositionComponent,
} from '../components.js';
import { COMPONENT_KINDS } from '../components.js';
import type { System } from '../world.js';
import type { Tunables } from '../tunables.js';
import type { InputState } from '../input.js';

export interface PlayerControllerOptions {
  tunables: Tunables;
  getInput(): InputState;
  /** Engine emits this when fireball is requested by the player. */
  onAttack(playerEntity: number): void;
  /** Engine emits this when a jump impulse is applied (for sfx). */
  onJump(): void;
}

export class PlayerControllerSystem implements System {
  readonly name = 'player-controller';
  /** Tracks rising-edge of the jump button so we can refill the buffer. */
  private prevJump = false;
  private prevAttack = false;

  constructor(private readonly opts: PlayerControllerOptions) {}

  update(world: import('../world.js').EngineWorld, dt: number): void {
    const input = this.opts.getInput();
    const dtMs = dt * 1000;
    const tun = this.opts.tunables;

    for (const entity of world.query([
      COMPONENT_KINDS.playerControl,
      COMPONENT_KINDS.playerState,
      COMPONENT_KINDS.velocity,
      COMPONENT_KINDS.body,
      COMPONENT_KINDS.position,
    ])) {
      const ctrl = world.getComponent<PlayerControlComponent>(entity, COMPONENT_KINDS.playerControl)!;
      const state = world.getComponent<PlayerStateComponent>(entity, COMPONENT_KINDS.playerState)!;
      const vel = world.getComponent<VelocityComponent>(entity, COMPONENT_KINDS.velocity)!;
      const body = world.getComponent<BodyComponent>(entity, COMPONENT_KINDS.body)!;
      const pos = world.getComponent<PositionComponent>(entity, COMPONENT_KINDS.position)!;

      // Horizontal
      const cap = input.run ? tun.runCap : tun.walkCap;
      ctrl.wantsRun = input.run;
      let targetVx = vel.vx;
      if (input.left && !input.right) {
        targetVx -= tun.walkAccel * dt;
        state.faceDir = -1;
      } else if (input.right && !input.left) {
        targetVx += tun.walkAccel * dt;
        state.faceDir = 1;
      } else {
        // friction
        const sign = Math.sign(vel.vx);
        const decel = tun.friction * dt;
        if (Math.abs(vel.vx) <= decel) targetVx = 0;
        else targetVx -= sign * decel;
      }
      vel.vx = Math.max(-cap, Math.min(cap, targetVx));

      // Coyote and buffer windows
      if (body.grounded) ctrl.coyoteMs = tun.coyoteMs;
      else ctrl.coyoteMs = Math.max(0, ctrl.coyoteMs - dtMs);

      const jumpEdge = input.jump && !this.prevJump;
      if (jumpEdge) ctrl.bufferMs = tun.bufferMs;
      else ctrl.bufferMs = Math.max(0, ctrl.bufferMs - dtMs);
      ctrl.jumpHeld = input.jump;

      const canJump = ctrl.coyoteMs > 0 && ctrl.bufferMs > 0;
      if (canJump) {
        vel.vy = tun.jumpImpulse;
        body.grounded = false;
        ctrl.coyoteMs = 0;
        ctrl.bufferMs = 0;
        this.opts.onJump();
      }
      ctrl.wantsJump = input.jump;

      // Ducking
      ctrl.ducking = input.down && body.grounded;

      // Attack (fireball) edge
      const attackEdge = input.attack && !this.prevAttack;
      if (attackEdge && state.power === 'fire') {
        ctrl.attackQueued = true;
        this.opts.onAttack(entity);
      } else {
        ctrl.attackQueued = false;
      }

      // Decay timers
      if (state.iframesMs > 0) state.iframesMs = Math.max(0, state.iframesMs - dtMs);
      if (state.starMs > 0) state.starMs = Math.max(0, state.starMs - dtMs);

      // touch pos to match body x; integration system writes back later
      void pos;
    }

    this.prevJump = input.jump;
    this.prevAttack = input.attack;
  }
}
