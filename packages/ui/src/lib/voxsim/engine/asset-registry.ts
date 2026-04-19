import type { VoxelKind } from '../types.js';

/**
 * Engine-local asset registry. Resolves bundle ids to per-voxel-kind material
 * configs, mesh templates, and skybox descriptors. Stays free of network and
 * file-system access so tests and headless training workers can import it
 * cleanly; concrete loaders (textures, GLTF) plug in through the registry's
 * `register*` methods.
 */

export interface VoxelMaterialConfig {
  /** 0xRRGGBB tint for the placeholder bundle. */
  color: number;
  roughness: number;
  metalness: number;
  /** Render this voxel kind even when treated as fully transparent. */
  renderEvenIfHollow?: boolean;
}

export interface MeshTemplate {
  id: string;
  /** Width / height / depth in world units, axis-aligned. */
  size: { x: number; y: number; z: number };
  color: number;
}

export interface SkyboxDescriptor {
  id: string;
  /** Top-to-bottom gradient stops in CSS color form. */
  gradient: string[];
}

export interface AssetBundle {
  id: string;
  voxelMaterials: Readonly<Record<VoxelKind, VoxelMaterialConfig>>;
  meshes: Readonly<Record<string, MeshTemplate>>;
  skyboxes: Readonly<Record<string, SkyboxDescriptor>>;
}

/**
 * Default voxsim bundle. Uses solid tints in lieu of textures so the engine
 * can render and tests can exercise the pipeline without art assets.
 */
export const DEFAULT_BUNDLE: AssetBundle = {
  id: 'default',
  voxelMaterials: {
    empty:  { color: 0x000000, roughness: 1.0, metalness: 0 },
    solid:  { color: 0x6e6e6e, roughness: 0.85, metalness: 0 },
    ramp:   { color: 0x9a8b6b, roughness: 0.9,  metalness: 0 },
    hazard: { color: 0xc23030, roughness: 0.6,  metalness: 0 },
    goal:   { color: 0x33b964, roughness: 0.4,  metalness: 0, renderEvenIfHollow: true },
    food:   { color: 0xf5b133, roughness: 0.5,  metalness: 0, renderEvenIfHollow: true },
    water:  { color: 0x3a78c2, roughness: 0.2,  metalness: 0.1, renderEvenIfHollow: true },
    spawn:  { color: 0x9b59b6, roughness: 0.5,  metalness: 0, renderEvenIfHollow: true },
  },
  meshes: {
    'agent.debugBox': { id: 'agent.debugBox', size: { x: 0.4, y: 1.0, z: 0.4 }, color: 0xffffff },
    'entity.propBox': { id: 'entity.propBox', size: { x: 0.6, y: 0.6, z: 0.6 }, color: 0xb88c4a },
    'entity.foodPile': { id: 'entity.foodPile', size: { x: 0.5, y: 0.3, z: 0.5 }, color: 0xf5b133 },
    'entity.hazardField': { id: 'entity.hazardField', size: { x: 0.8, y: 0.05, z: 0.8 }, color: 0xc23030 },
    'entity.goalMarker': { id: 'entity.goalMarker', size: { x: 0.4, y: 1.6, z: 0.4 }, color: 0x33b964 },
  },
  skyboxes: {
    default: { id: 'default', gradient: ['#5b6f8a', '#a8c5e6', '#dfe9f3'] },
    night: { id: 'night', gradient: ['#0a0e2c', '#1f2452', '#3a3f76'] },
  },
};

export class AssetRegistry {
  private readonly bundles = new Map<string, AssetBundle>();

  constructor(initial: readonly AssetBundle[] = [DEFAULT_BUNDLE]) {
    for (const bundle of initial) this.bundles.set(bundle.id, bundle);
  }

  register(bundle: AssetBundle): void {
    this.bundles.set(bundle.id, bundle);
  }

  resolve(bundleId: string): AssetBundle {
    const bundle = this.bundles.get(bundleId);
    if (!bundle) {
      throw new Error(
        `Asset bundle "${bundleId}" is not registered. Known bundles: ${[...this.bundles.keys()].join(', ') || '(none)'}.`,
      );
    }
    return bundle;
  }

  has(bundleId: string): boolean {
    return this.bundles.has(bundleId);
  }
}
