import { Group, type Scene } from 'three';

/**
 * Strict z-ordered scene layer model that downstream plans bind into. Each
 * layer is a `THREE.Group`; downstream plans add and remove children without
 * traversing the scene root.
 *
 * `hud` is a placeholder group; the engine does not render HTML. The page
 * model owns DOM overlays separately.
 */
export interface SceneLayers {
  arena: Group;
  agents: Group;
  entities: Group;
  debug: Group;
  overlay: Group;
  hud: Group;
}

const LAYER_ORDER: readonly (keyof SceneLayers)[] = [
  'arena',
  'agents',
  'entities',
  'debug',
  'overlay',
  'hud',
] as const;

/**
 * Construct the layered scene model and attach each layer group to the scene
 * in declared order. Returns the typed handles for downstream plans.
 */
export function attachSceneLayers(scene: Scene): SceneLayers {
  const layers = {} as SceneLayers;
  for (const name of LAYER_ORDER) {
    const group = new Group();
    group.name = `voxsim:${name}`;
    scene.add(group);
    layers[name] = group;
  }
  return layers;
}

/** Detach and dispose every layer group, clearing render state on teardown. */
export function disposeSceneLayers(scene: Scene, layers: SceneLayers): void {
  for (const name of LAYER_ORDER) {
    const group = layers[name];
    group.removeFromParent();
    group.clear();
  }
}
