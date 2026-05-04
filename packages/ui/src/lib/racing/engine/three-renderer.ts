/**
 * Three.js renderer for the racing engine. Responsibilities:
 *
 *   - Create the WebGL renderer, camera, scene, and lighting.
 *   - Build the chassis + four wheel meshes from a vehicle preset.
 *   - Build the track ribbon mesh from a `TrackPreset` plus surface
 *     overlays (rubber line / marbles / curbs / damp / gravel).
 *   - Place scenery via `placeScenery` and instance an asset per `kind`.
 *   - Sync chassis pose every frame from the engine state.
 *
 * Asset loading goes through the optional `getAsset(name)` callback. If the
 * callback returns `undefined`, the renderer falls back to flat-shaded
 * primitive cubes / discs so the prototype is always renderable.
 */

import {
  BoxGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Shape,
  ShapeGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { sampleCentripetal, type SampledPoint } from './tracks/catmull-rom.js';
import { placeScenery, type PropKind } from './tracks/scenery-placement.js';
import type { TrackPreset, VehiclePreset } from '../types.js';

export interface RacingRendererOptions {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  pixelRatio?: number;
  /** Look up an asset object3d by logical name (e.g. 'cone'). */
  getAsset?: (name: string) => Object3D | undefined;
}

export interface ChassisPose {
  position: { x: number; y: number; z: number };
  quaternion: { x: number; y: number; z: number; w: number };
}

export interface WheelPose {
  index: number;
  position: { x: number; y: number; z: number };
  spinAngle: number;
  steerAngle: number;
}

const PROP_FALLBACK_COLOR: Record<PropKind, number> = {
  cone: 0xff8a3d,
  barrier: 0xc6ccd6,
  light: 0xfff3a3,
  billboard: 0x6c7a89,
};

const PROP_ASSET_FILE: Record<PropKind, string> = {
  cone: 'cone.glb',
  barrier: 'barrierWhite.glb',
  light: 'lightPostModern.glb',
  billboard: 'billboard.glb',
};

export class RacingRenderer {
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  readonly renderer: WebGLRenderer;

  readonly chassis = new Group();
  readonly wheels: Mesh[] = [];

  private trackRoot: Group | null = null;
  private propsRoot: Group | null = null;
  private readonly gltfLoader = new GLTFLoader();
  private readonly assetCache = new Map<PropKind, Object3D | null>();
  private readonly assetLoads = new Map<PropKind, Promise<void>>();
  private lastTrackPreset: TrackPreset | null = null;
  private lastTrackPoints: SampledPoint[] = [];

  constructor(private readonly opts: RacingRendererOptions) {
    this.renderer = new WebGLRenderer({ canvas: opts.canvas, antialias: true });
    this.renderer.setPixelRatio(opts.pixelRatio ?? 1);
    this.renderer.setSize(opts.width, opts.height, false);
    this.scene.background = new Color(0x101418);
    this.camera = new PerspectiveCamera(58, opts.width / opts.height, 0.1, 800);
    this.camera.position.set(0, 8, -8);

    const hemi = new HemisphereLight(0xc6e7ff, 0x303030, 0.6);
    const sun = new DirectionalLight(0xffffff, 0.85);
    sun.position.set(80, 120, 60);
    this.scene.add(hemi, sun);

    const groundGeo = new PlaneGeometry(800, 800);
    const groundMat = new MeshLambertMaterial({ color: 0x33632e });
    const ground = new Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);

    this.scene.add(this.chassis);
  }

  setSize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  setVehiclePreset(preset: VehiclePreset): void {
    while (this.chassis.children.length) this.chassis.remove(this.chassis.children[0]);
    this.wheels.length = 0;
    const body = new Mesh(
      new BoxGeometry(preset.trackWidth, 0.5, preset.wheelbase),
      new MeshStandardMaterial({ color: preset.color, roughness: 0.55 }),
    );
    body.position.y = 0.45;
    this.chassis.add(body);

    const halfTrack = preset.trackWidth * 0.5;
    const frontZ = preset.wheelbase * (1 - preset.frontMassPct);
    const rearZ = -preset.wheelbase * preset.frontMassPct;
    const offsets = [
      { x: halfTrack, z: frontZ },
      { x: -halfTrack, z: frontZ },
      { x: halfTrack, z: rearZ },
      { x: -halfTrack, z: rearZ },
    ];
    for (const o of offsets) {
      const wheel = new Mesh(
        new CylinderGeometry(0.34, 0.34, 0.22, 24),
        new MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.85 }),
      );
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(o.x, 0, o.z);
      this.chassis.add(wheel);
      this.wheels.push(wheel);
    }
  }

  setChassisPose(pose: ChassisPose): void {
    this.chassis.position.set(pose.position.x, pose.position.y, pose.position.z);
    this.chassis.quaternion.set(
      pose.quaternion.x,
      pose.quaternion.y,
      pose.quaternion.z,
      pose.quaternion.w,
    );
  }

  setWheelPoses(poses: ReadonlyArray<WheelPose>): void {
    for (const w of poses) {
      const mesh = this.wheels[w.index];
      if (!mesh) continue;
      mesh.position.set(w.position.x, w.position.y, w.position.z);
      mesh.rotation.set(0, w.steerAngle, Math.PI / 2 + w.spinAngle);
    }
  }

  /**
   * Build the track surface (asphalt plane + edges). Future iterations will
   * paint rubber-line / marbles / damp / gravel zone overlays here too — for
   * day-one we keep the renderer minimal so the route mounts quickly.
   */
  buildTrack(preset: TrackPreset): { points: SampledPoint[] } {
    if (this.trackRoot) {
      this.scene.remove(this.trackRoot);
    }
    this.trackRoot = new Group();
    const points = sampleCentripetal(preset.ctrl, preset.samples);
    this.lastTrackPreset = preset;
    this.lastTrackPoints = [...points];
    const ribbon = buildRibbonGeometry(points, preset.halfWidth);
    const mesh = new Mesh(
      ribbon,
      new MeshStandardMaterial({ color: 0x232830, roughness: 0.75 }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.02;
    this.trackRoot.add(mesh);
    this.scene.add(this.trackRoot);
    this.placeScenery(preset, points);
    return { points };
  }

  private placeScenery(preset: TrackPreset, points: SampledPoint[]): void {
    if (this.propsRoot) {
      this.scene.remove(this.propsRoot);
    }
    this.propsRoot = new Group();
    const placements = placeScenery({
      centerline: points,
      halfWidth: preset.halfWidth,
      cadence: preset.propCadence,
    });
    this.primeAssets(placements.map((placement) => placement.kind));
    for (const p of placements) {
      const asset = this.opts.getAsset?.(p.kind) ?? this.assetCache.get(p.kind) ?? undefined;
      const node = asset ? asset.clone() : this.fallbackProp(p.kind);
      node.position.set(p.x, p.y, p.z);
      node.rotation.y = p.rot;
      this.propsRoot.add(node);
    }
    this.scene.add(this.propsRoot);
  }

  private primeAssets(kinds: Iterable<PropKind>): void {
    if (this.opts.getAsset) return;
    for (const kind of new Set(kinds)) {
      if (this.assetCache.has(kind) || this.assetLoads.has(kind)) continue;
      const file = PROP_ASSET_FILE[kind];
      const load = this.gltfLoader
        .loadAsync(`/racing/extracted/${file}`)
        .then((gltf) => {
          this.assetCache.set(kind, gltf.scene);
          if (this.lastTrackPreset) {
            this.placeScenery(this.lastTrackPreset, this.lastTrackPoints);
          }
        })
        .catch((error) => {
          console.warn(`Failed to load racing asset ${file}`, error);
          this.assetCache.set(kind, null);
        })
        .finally(() => {
          this.assetLoads.delete(kind);
        });
      this.assetLoads.set(kind, load);
    }
  }

  private fallbackProp(kind: PropKind): Object3D {
    const geo = new BoxGeometry(0.4, 0.6, 0.4);
    const mat = new MeshLambertMaterial({ color: PROP_FALLBACK_COLOR[kind] });
    const m = new Mesh(geo, mat);
    m.position.y = 0.3;
    return m;
  }

  setCameraPose(
    position: Vector3 | { x: number; y: number; z: number },
    target: Vector3 | { x: number; y: number; z: number },
    up: Vector3 | { x: number; y: number; z: number },
  ): void {
    this.camera.up.set(up.x, up.y, up.z);
    this.camera.position.set(position.x, position.y, position.z);
    this.camera.lookAt(target.x, target.y, target.z);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.renderer.dispose();
  }
}

function buildRibbonGeometry(points: ReadonlyArray<SampledPoint>, halfWidth: number): ShapeGeometry {
  const shape = new Shape();
  if (points.length === 0) return new ShapeGeometry(shape);
  // Build closed polygon: outer-left, then outer-right reversed, then close.
  const outer: SampledPoint[] = [];
  const inner: SampledPoint[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const L = Math.hypot(dx, dz) || 1;
    const nx = -dz / L;
    const nz = dx / L;
    outer.push({ x: a.x + nx * halfWidth, z: a.z + nz * halfWidth });
    inner.push({ x: a.x - nx * halfWidth, z: a.z - nz * halfWidth });
  }
  const first = outer[0];
  shape.moveTo(first.x, first.z);
  for (let i = 1; i < outer.length; i++) shape.lineTo(outer[i].x, outer[i].z);
  for (let i = inner.length - 1; i >= 0; i--) shape.lineTo(inner[i].x, inner[i].z);
  shape.closePath();
  return new ShapeGeometry(shape);
}

// Imported in the function above; pulled into this module to keep the
// `CatmullRomCurve3` reference reachable for renderer-side smoothing in
// future iterations.
const _ = CatmullRomCurve3;
