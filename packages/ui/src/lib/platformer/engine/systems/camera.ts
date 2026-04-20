import { COMPONENT_KINDS } from '../components.js';
import type { CameraComponent, PositionComponent, BodyComponent } from '../components.js';
import type { System, EngineWorld } from '../world.js';

export interface CameraOptions {
  viewportWidth: number;
  mapWidthPx: number;
  /** Pixel offset before the level wraps; tracked as `Camera.minX`. */
}

export class CameraSystem implements System {
  readonly name = 'camera';
  constructor(private readonly opts: CameraOptions, private readonly playerEntityRef: { value: number | null }) {}

  update(world: EngineWorld): void {
    const playerEntity = this.playerEntityRef.value;
    if (playerEntity == null) return;
    const playerPos = world.getComponent<PositionComponent>(playerEntity, COMPONENT_KINDS.position);
    const playerBody = world.getComponent<BodyComponent>(playerEntity, COMPONENT_KINDS.body);
    if (!playerPos || !playerBody) return;

    for (const entity of world.query([COMPONENT_KINDS.camera])) {
      const cam = world.getComponent<CameraComponent>(entity, COMPONENT_KINDS.camera)!;
      const playerCenter = playerPos.x + playerBody.aabb.width / 2;
      const left = cam.x + this.opts.viewportWidth / 2 - cam.deadzoneHalfWidth;
      const right = cam.x + this.opts.viewportWidth / 2 + cam.deadzoneHalfWidth;
      if (playerCenter > right) cam.x += playerCenter - right;
      else if (playerCenter < left) cam.x = Math.max(cam.minX, cam.x + (playerCenter - left));
      if (cam.x < cam.minX) cam.x = cam.minX;
      if (cam.x > this.opts.mapWidthPx - this.opts.viewportWidth) {
        cam.x = Math.max(cam.minX, this.opts.mapWidthPx - this.opts.viewportWidth);
      }
      // Never scroll back: ratchet minX upward.
      cam.minX = Math.max(cam.minX, cam.x);
    }
  }
}
