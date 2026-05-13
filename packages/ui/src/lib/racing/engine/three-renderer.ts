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
  AmbientLight,
  BackSide,
  Box3,
  BoxGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  FogExp2,
  Group,
  HemisphereLight,
  Mesh,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Object3D,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Shape,
  ShapeGeometry,
  SphereGeometry,
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

const PROP_FALLBACK_COLOR: Record<string, number | undefined> = {
  cone: 0xff8a3d,
  barrier: 0xc6ccd6,
  light: 0xfff3a3,
  billboard: 0x6c7a89,
  flag: 0xff4444,
  fence: 0x999999,
  grandStand: 0xaaddff,
  pitBuilding: 0xccaa88,
  pylon: 0xffaa00,
  banner: 0x44aa44,
  radar: 0x8888ff,
  overhead: 0xdddddd,
};

const PROP_ASSET_FILE: Record<string, string | undefined> = {
  cone: 'cone.glb',
  barrier: 'barrierWhite.glb',
  light: 'lightPostModern.glb',
  billboard: 'billboard.glb',
  flag: 'flagCheckers.glb',
  fence: 'fenceStraight.glb',
  grandStand: 'grandStand.glb',
  pitBuilding: 'pitsOffice.glb',
  pylon: 'pylon.glb',
  banner: 'bannerTowerGreen.glb',
  radar: 'radarEquipment.glb',
  overhead: 'overhead.glb',
};

const DEFAULT_BODY_LENGTH_PADDING_M = 1.95;
const DEFAULT_BODY_WIDTH_PADDING_M = 0.32;
const DEFAULT_BODY_HEIGHT_M = 1.28;
const DEFAULT_FRONT_TIRE_DIAMETER_M = 0.68;
const DEFAULT_REAR_TIRE_DIAMETER_M = 0.68;
const DEFAULT_FRONT_TIRE_WIDTH_M = 0.30;
const DEFAULT_REAR_TIRE_WIDTH_M = 0.30;
function resolveFrontTrackWidthM(preset: VehiclePreset): number {
  return preset.dimensions?.frontTrackWidthM ?? preset.trackWidth;
}

function resolveRearTrackWidthM(preset: VehiclePreset): number {
  return preset.dimensions?.rearTrackWidthM ?? preset.trackWidth;
}

function resolveBodyWidthM(preset: VehiclePreset): number {
  return preset.dimensions?.overallWidthM
    ?? Math.max(resolveFrontTrackWidthM(preset), resolveRearTrackWidthM(preset)) + DEFAULT_BODY_WIDTH_PADDING_M;
}

function resolveBodyLengthM(preset: VehiclePreset): number {
  return preset.dimensions?.overallLengthM ?? preset.wheelbase + DEFAULT_BODY_LENGTH_PADDING_M;
}

function resolveFrontTireDiameterM(preset: VehiclePreset): number {
  return preset.tires?.frontOverallDiameterM ?? DEFAULT_FRONT_TIRE_DIAMETER_M;
}

function resolveRearTireDiameterM(preset: VehiclePreset): number {
  return preset.tires?.rearOverallDiameterM ?? DEFAULT_REAR_TIRE_DIAMETER_M;
}

function resolveFrontTireWidthM(preset: VehiclePreset): number {
  return preset.tires?.frontSectionWidthM ?? DEFAULT_FRONT_TIRE_WIDTH_M;
}

function resolveRearTireWidthM(preset: VehiclePreset): number {
  return preset.tires?.rearSectionWidthM ?? DEFAULT_REAR_TIRE_WIDTH_M;
}

export class RacingRenderer {
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  readonly renderer: WebGLRenderer;

  readonly chassis = new Group();
  readonly wheels: Mesh[] = [];
  private wheelBaseRotations: Array<{ x: number; y: number; z: number }> = [];

  private trackRoot: Group | null = null;
  private propsRoot: Group | null = null;
  private readonly gltfLoader = new GLTFLoader();
  private readonly assetCache = new Map<string, Object3D | null>();
  private readonly assetLoads = new Map<string, Promise<void>>();
  private lastTrackPreset: TrackPreset | null = null;
  private lastTrackPoints: SampledPoint[] = [];
  private vehicleScene: Group | null = null;
  private lastVehiclePreset: VehiclePreset | null = null;

  constructor(private readonly opts: RacingRendererOptions) {
    this.renderer = new WebGLRenderer({ canvas: opts.canvas, antialias: true });
    this.renderer.setPixelRatio(opts.pixelRatio ?? 1);
    this.renderer.setSize(opts.width, opts.height, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.scene.background = new Color(0x101418);
    this.scene.fog = new FogExp2(0x101418, 0.002);
    this.camera = new PerspectiveCamera(58, opts.width / opts.height, 0.1, 800);
    this.camera.position.set(0, 8, -8);

    const hemi = new HemisphereLight(0xaaccff, 0x2a3a1a, 0.5);
    const sun = new DirectionalLight(0xfff5e6, 1.0);
    sun.position.set(60, 80, 40);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 500;
    const d = 150;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    this.scene.add(hemi, sun);

    const ambient = new AmbientLight(0x404040, 0.3);
    this.scene.add(ambient);

    // Grass ground plane
    const groundGeo = new PlaneGeometry(800, 800);
    const groundMat = new MeshLambertMaterial({ color: 0x2d4a22 });
    const ground = new Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.015;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Inner asphalt apron around typical track area
    const apronGeo = new PlaneGeometry(200, 200);
    const apronMat = new MeshLambertMaterial({ color: 0x333333 });
    const apron = new Mesh(apronGeo, apronMat);
    apron.rotation.x = -Math.PI / 2;
    apron.position.y = -0.01;
    apron.receiveShadow = true;
    this.scene.add(apron);

    // Sky dome
    const skyGeo = new SphereGeometry(500, 32, 32);
    const skyMat = new ShaderMaterial({
      uniforms: {
        topColor: { value: new Color(0x0077ff) },
        bottomColor: { value: new Color(0x101418) },
        offset: { value: 33 },
        exponent: { value: 0.6 },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
        }
      `,
      side: BackSide,
    });
    const sky = new Mesh(skyGeo, skyMat);
    this.scene.add(sky);

    this.scene.add(this.chassis);

    this.gltfLoader
      .loadAsync('/racing/extracted/race-future.glb')
      .then((gltf) => {
        this.vehicleScene = gltf.scene;
        if (this.lastVehiclePreset) {
          this.setVehiclePreset(this.lastVehiclePreset);
        }
      })
      .catch((err) => {
        console.warn('Failed to load race-future.glb, will use primitive fallback', err);
        this.vehicleScene = null;
      });
  }

  setSize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  setVehiclePreset(preset: VehiclePreset): void {
    this.lastVehiclePreset = preset;
    while (this.chassis.children.length) this.chassis.remove(this.chassis.children[0]);
    this.wheels.length = 0;
    this.wheelBaseRotations.length = 0;

    if (this.vehicleScene) {
      const asset = this.vehicleScene.clone();
      const assetBody = findAssetBodyMesh(asset);
      if (assetBody) {
        fitBodyMeshToPreset(assetBody, preset);
        const bodyRoot = new Group();
        bodyRoot.rotation.y = Math.PI;
        bodyRoot.add(assetBody);
        assetBody.traverse((child) => {
          if (child instanceof Mesh) child.castShadow = true;
        });
        this.chassis.add(bodyRoot);
      }
      const assetWheels = findAssetWheelMeshes(asset);
      if (assetWheels.length === 4) {
        const targetWidths = [
          resolveFrontTireWidthM(preset),
          resolveFrontTireWidthM(preset),
          resolveRearTireWidthM(preset),
          resolveRearTireWidthM(preset),
        ];
        const targetDiameters = [
          resolveFrontTireDiameterM(preset),
          resolveFrontTireDiameterM(preset),
          resolveRearTireDiameterM(preset),
          resolveRearTireDiameterM(preset),
        ];
        assetWheels.forEach((wheel, index) => {
          fitWheelMeshToPreset(wheel, targetDiameters[index], targetWidths[index]);
          wheel.rotation.y += Math.PI;
          wheel.castShadow = true;
          this.chassis.add(wheel);
        });
        this.wheels.push(...assetWheels);
        this.wheelBaseRotations.push(
          ...assetWheels.map((wheel) => ({
            x: wheel.rotation.x,
            y: wheel.rotation.y,
            z: wheel.rotation.z,
          })),
        );
      }
    } else {
      const body = new Mesh(
        new BoxGeometry(resolveBodyWidthM(preset), DEFAULT_BODY_HEIGHT_M * 0.42, resolveBodyLengthM(preset)),
        new MeshStandardMaterial({ color: preset.color, roughness: 0.55 }),
      );
      body.position.y = 0.45;
      body.castShadow = true;
      this.chassis.add(body);
    }

    if (this.wheels.length === 4) return;

    const halfFrontTrack = resolveFrontTrackWidthM(preset) * 0.5;
    const halfRearTrack = resolveRearTrackWidthM(preset) * 0.5;
    // Match the engine convention: chassis forward = -Z, so the front wheels
    // sit at negative Z relative to the chassis origin.
    const frontZ = -preset.wheelbase * (1 - preset.frontMassPct);
    const rearZ = preset.wheelbase * preset.frontMassPct;
    const offsets = [
      { x: -halfFrontTrack, z: frontZ, radius: resolveFrontTireDiameterM(preset) * 0.5, width: resolveFrontTireWidthM(preset) },
      { x: halfFrontTrack, z: frontZ, radius: resolveFrontTireDiameterM(preset) * 0.5, width: resolveFrontTireWidthM(preset) },
      { x: -halfRearTrack, z: rearZ, radius: resolveRearTireDiameterM(preset) * 0.5, width: resolveRearTireWidthM(preset) },
      { x: halfRearTrack, z: rearZ, radius: resolveRearTireDiameterM(preset) * 0.5, width: resolveRearTireWidthM(preset) },
    ];
    for (const o of offsets) {
      const wheel = new Mesh(
        new CylinderGeometry(o.radius, o.radius, o.width, 24),
        new MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.85 }),
      );
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(o.x, 0, o.z);
      this.chassis.add(wheel);
      this.wheels.push(wheel);
      this.wheelBaseRotations.push({ x: 0, y: 0, z: Math.PI / 2 });
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
      // Match the engine convention: positive steer is a left turn.
      const base = this.wheelBaseRotations[w.index] ?? { x: 0, y: 0, z: 0 };
      mesh.rotation.set(base.x + w.spinAngle, base.y - w.steerAngle, base.z);
    }
  }

  /**
   * Build the track surface (asphalt ribbon + kerbs + rubber line +
   * surface zone overlays). Additional visual detail added in iteration 4.
   */
  buildTrack(preset: TrackPreset): { points: SampledPoint[] } {
    if (this.trackRoot) {
      this.scene.remove(this.trackRoot);
    }
    this.trackRoot = new Group();
    const points = sampleCentripetal(preset.ctrl, preset.samples);
    this.lastTrackPreset = preset;
    this.lastTrackPoints = [...points];

    // Main asphalt ribbon
    const ribbon = buildRibbonGeometry(points, preset.halfWidth);
    const mesh = new Mesh(
      ribbon,
      new MeshStandardMaterial({ color: 0x232830, roughness: 0.75 }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.02;
    this.trackRoot.add(mesh);

    // Rubber line
    const rubberWidth = preset.rubberWidth ?? preset.halfWidth * 0.25;
    const rubberGeo = buildRibbonGeometry(points, rubberWidth);
    const rubberMesh = new Mesh(
      rubberGeo,
      new MeshStandardMaterial({ color: 0x1a1d23, roughness: 0.85 }),
    );
    rubberMesh.rotation.x = -Math.PI / 2;
    rubberMesh.position.y = 0.025;
    this.trackRoot.add(rubberMesh);

    // Kerbs
    const curbHeight = preset.kerbProfile?.crownHeightM ?? 0.08;
    const kerbs = buildKerbs(points, preset.halfWidth, preset.curbWidth, curbHeight);
    this.trackRoot.add(kerbs);

    // Surface zones (gravel, damp, explicit surface tints)
    this.renderSurfaceZones(preset);

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
      node.traverse((child) => {
        if (child instanceof Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      this.propsRoot.add(node);
    }
    this.scene.add(this.propsRoot);
  }

  private primeAssets(kinds: Iterable<string>): void {
    if (this.opts.getAsset) return;
    for (const kind of new Set(kinds)) {
      if (this.assetCache.has(kind) || this.assetLoads.has(kind)) continue;
      const file = PROP_ASSET_FILE[kind];
      if (!file) {
        this.assetCache.set(kind, null);
        continue;
      }
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

  private renderSurfaceZones(preset: TrackPreset): void {
    if (!this.trackRoot) return;

    // Gravel zones
    for (const zone of preset.gravelZones ?? []) {
      const geo = new PlaneGeometry(zone.w ?? 10, zone.h ?? 10);
      const mat = new MeshLambertMaterial({ color: 0xc2b280, side: DoubleSide });
      const m = new Mesh(geo, mat);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = (zone.rot ?? 0) * (Math.PI / 180);
      m.position.set(zone.x, 0.015, zone.z);
      this.trackRoot.add(m);
    }

    // Damp zones
    for (const zone of preset.dampZones ?? []) {
      const geo = new PlaneGeometry(zone.w ?? 10, zone.h ?? 10);
      const mat = new MeshLambertMaterial({ color: 0x4488aa, transparent: true, opacity: 0.35, side: DoubleSide });
      const m = new Mesh(geo, mat);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = (zone.rot ?? 0) * (Math.PI / 180);
      m.position.set(zone.x, 0.015, zone.z);
      this.trackRoot.add(m);
    }

    // Surface zones
    const surfaceColors: Record<string, number> = {
      RUBBER: 0x1a1d23,
      ASPHALT: 0x232830,
      MARBLES: 0x444444,
      DAMP: 0x4488aa,
      CURB: 0xcc2222,
      GRASS: 0x2d5a27,
      GRAVEL: 0xc2b280,
    };
    for (const zone of preset.surfaceZones ?? []) {
      const geo = new PlaneGeometry(zone.w, zone.h);
      const color = surfaceColors[zone.surface] ?? 0x888888;
      const mat = new MeshLambertMaterial({ color, transparent: true, opacity: 0.4, side: DoubleSide });
      const m = new Mesh(geo, mat);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = zone.rot * (Math.PI / 180);
      m.position.set(zone.x, 0.015, zone.z);
      this.trackRoot.add(m);
    }
  }

  private fallbackProp(kind: string): Object3D {
    const geo = new BoxGeometry(0.4, 0.6, 0.4);
    const mat = new MeshLambertMaterial({ color: PROP_FALLBACK_COLOR[kind] ?? 0x888888 });
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

function findAssetWheelMeshes(root: Object3D): Mesh[] {
  const wheelMap = new Map<string, Mesh>();
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const name = child.name.toLowerCase();
    if (name.includes('wheel-front-left')) wheelMap.set('fl', child);
    else if (name.includes('wheel-front-right')) wheelMap.set('fr', child);
    else if (name.includes('wheel-back-left')) wheelMap.set('rl', child);
    else if (name.includes('wheel-back-right')) wheelMap.set('rr', child);
  });
  return ['fl', 'fr', 'rl', 'rr']
    .map((key) => wheelMap.get(key))
    .filter((wheel): wheel is Mesh => Boolean(wheel));
}

function findAssetBodyMesh(root: Object3D): Mesh | null {
  let body: Mesh | null = null;
  root.traverse((child) => {
    if (body || !(child instanceof Mesh)) return;
    if (child.name.toLowerCase() === 'body') body = child;
  });
  return body;
}

function fitBodyMeshToPreset(body: Mesh, preset: VehiclePreset): void {
  const size = new Vector3();
  new Box3().setFromObject(body).getSize(size);
  const targetWidth = resolveBodyWidthM(preset);
  const targetLength = resolveBodyLengthM(preset);
  const targetHeight = preset.dimensions?.overallHeightM ?? DEFAULT_BODY_HEIGHT_M;
  const scaleX = targetWidth / Math.max(size.x, 1e-6);
  const scaleY = targetHeight / Math.max(size.y, 1e-6);
  const scaleZ = targetLength / Math.max(size.z, 1e-6);
  body.scale.set(scaleX, scaleY, scaleZ);
}

function fitWheelMeshToPreset(wheel: Mesh, targetDiameterM: number, targetWidthM: number): void {
  const size = new Vector3();
  new Box3().setFromObject(wheel).getSize(size);
  const dims = [
    { axis: 'x' as const, value: size.x },
    { axis: 'y' as const, value: size.y },
    { axis: 'z' as const, value: size.z },
  ].sort((a, b) => a.value - b.value);
  const widthAxis = dims[0]?.axis ?? 'x';
  const diameterAxisA = dims[1]?.axis ?? 'y';
  const diameterAxisB = dims[2]?.axis ?? 'z';
  const widthBase = Math.max(dims[0]?.value ?? 1, 1e-6);
  const diameterBase = Math.max((dims[1]?.value ?? 1) + (dims[2]?.value ?? 1), 2e-6) * 0.5;
  const nextScale = {
    x: 1,
    y: 1,
    z: 1,
  };
  nextScale[widthAxis] = targetWidthM / widthBase;
  nextScale[diameterAxisA] = targetDiameterM / diameterBase;
  nextScale[diameterAxisB] = targetDiameterM / diameterBase;
  wheel.scale.set(nextScale.x, nextScale.y, nextScale.z);
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

function buildKerbs(
  points: ReadonlyArray<SampledPoint>,
  halfWidth: number,
  curbWidth: number,
  curbHeight: number,
): Group {
  const group = new Group();
  if (points.length === 0) return group;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const L = Math.hypot(dx, dz) || 1;
    const midX = (a.x + b.x) / 2;
    const midZ = (a.z + b.z) / 2;
    const nx = -dz / L;
    const nz = dx / L;

    const color = i % 2 === 0 ? 0xcc2222 : 0xeeeeee;
    const geo = new BoxGeometry(curbWidth, curbHeight, L);
    const mat = new MeshLambertMaterial({ color });

    // Left kerb
    const mesh = new Mesh(geo, mat);
    mesh.position.set(
      midX + nx * (halfWidth + curbWidth / 2),
      curbHeight / 2,
      midZ + nz * (halfWidth + curbWidth / 2),
    );
    mesh.rotation.y = Math.atan2(dx, dz);
    group.add(mesh);

    // Right kerb
    const mesh2 = mesh.clone();
    mesh2.position.set(
      midX - nx * (halfWidth + curbWidth / 2),
      curbHeight / 2,
      midZ - nz * (halfWidth + curbWidth / 2),
    );
    group.add(mesh2);
  }
  return group;
}

// Imported in the function above; pulled into this module to keep the
// `CatmullRomCurve3` reference reachable for renderer-side smoothing in
// future iterations.
const _ = CatmullRomCurve3;
