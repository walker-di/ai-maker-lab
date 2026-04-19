import { PerspectiveCamera, Raycaster, Vector2, Vector3 } from 'three';

import type { Vec3 } from '../types.js';

/**
 * Thin wrapper over Three's `PerspectiveCamera` that exposes the small set of
 * orbit-camera controls plan 01 commits to. The page model and editor adapter
 * use this surface to manipulate the camera; downstream plans (06 inspector
 * camera follow) extend it without modifying this module.
 */
export class OrbitCamera {
  readonly camera: PerspectiveCamera;
  private target: Vector3 = new Vector3();
  private distance = 12;
  private azimuth = Math.PI * 0.25;
  private elevation = Math.PI * 0.2;

  constructor(options: { fov?: number; aspect?: number; near?: number; far?: number } = {}) {
    this.camera = new PerspectiveCamera(
      options.fov ?? 60,
      options.aspect ?? 1,
      options.near ?? 0.1,
      options.far ?? 1000,
    );
    this.recompute();
  }

  setOrbitTarget(p: Vec3): void {
    this.target.set(p.x, p.y, p.z);
    this.recompute();
  }

  setDistance(d: number): void {
    this.distance = Math.max(0.01, d);
    this.recompute();
  }

  setAzimuth(a: number): void {
    this.azimuth = a;
    this.recompute();
  }

  setElevation(e: number): void {
    const limit = Math.PI * 0.49;
    this.elevation = Math.min(limit, Math.max(-limit, e));
    this.recompute();
  }

  setFov(f: number): void {
    this.camera.fov = f;
    this.camera.updateProjectionMatrix();
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Convert a normalized device coordinate `{ x, y } in [-1, 1]` into a world
   * ray origin and direction using the current camera state.
   */
  screenToWorldRay(p: { x: number; y: number }): { origin: Vec3; direction: Vec3 } {
    const raycaster = new Raycaster();
    raycaster.setFromCamera(new Vector2(p.x, p.y), this.camera);
    return {
      origin: { x: raycaster.ray.origin.x, y: raycaster.ray.origin.y, z: raycaster.ray.origin.z },
      direction: {
        x: raycaster.ray.direction.x,
        y: raycaster.ray.direction.y,
        z: raycaster.ray.direction.z,
      },
    };
  }

  getOrbitTarget(): Vec3 {
    return { x: this.target.x, y: this.target.y, z: this.target.z };
  }

  getAzimuth(): number {
    return this.azimuth;
  }

  getElevation(): number {
    return this.elevation;
  }

  getDistance(): number {
    return this.distance;
  }

  private recompute(): void {
    const cosE = Math.cos(this.elevation);
    const x = this.target.x + this.distance * cosE * Math.sin(this.azimuth);
    const y = this.target.y + this.distance * Math.sin(this.elevation);
    const z = this.target.z + this.distance * cosE * Math.cos(this.azimuth);
    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.target);
  }
}
