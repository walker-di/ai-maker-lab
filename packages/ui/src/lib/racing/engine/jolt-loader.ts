/**
 * Jolt physics loader. Owns the singleton wasm initialisation, the shared
 * physics system, the ground body, and the collision-layer table. The engine
 * imports `loadJolt` to await wasm and `createPhysicsContext` to build a
 * deterministic world for one session.
 *
 * Jolt is a heavy wasm module; we only load it when a runtime caller asks.
 * Tests stay in pure-physics-helper territory and don't touch this file.
 */

import initJolt from 'jolt-physics';

let joltModulePromise: Promise<typeof Jolt> | null = null;
type JoltApi = Awaited<ReturnType<typeof initJolt>>;
let JoltCache: JoltApi | null = null;

declare const Jolt: JoltApi;

/**
 * Initialise the Jolt wasm module exactly once per page. Subsequent calls
 * return the cached module synchronously (after the first promise resolves).
 */
export async function loadJolt(): Promise<JoltApi> {
  if (JoltCache) return JoltCache;
  if (!joltModulePromise) {
    joltModulePromise = (initJolt as unknown as () => Promise<JoltApi>)().then((mod) => {
      JoltCache = mod;
      return mod;
    });
  }
  return joltModulePromise;
}

export const COLLISION_LAYERS = Object.freeze({
  STATIC: 0,
  DYNAMIC: 1,
} as const);

export const NUM_OBJECT_LAYERS = 2;

export interface PhysicsContext {
  jolt: JoltApi;
  joltInterface: unknown;
  physicsSystem: unknown;
  bodyInterface: unknown;
}

/**
 * Build a fresh Jolt physics system with broadphase / object filters that
 * separate static (ground/scenery) from dynamic (chassis) bodies.
 *
 * The return type is intentionally `unknown` for the Jolt-side handles since
 * the racing engine only passes them around; calls go through Jolt's API
 * directly in the engine module.
 */
export async function createPhysicsContext(): Promise<PhysicsContext> {
  const J = await loadJolt();
  const settings = new (J as any).JoltSettings();
  // Broad-phase layers: 0 = static, 1 = dynamic. Two object layers
  // collide bidirectionally.
  const objectFilter = new (J as any).ObjectLayerPairFilterTable(NUM_OBJECT_LAYERS);
  objectFilter.EnableCollision(COLLISION_LAYERS.STATIC, COLLISION_LAYERS.DYNAMIC);
  objectFilter.EnableCollision(COLLISION_LAYERS.DYNAMIC, COLLISION_LAYERS.DYNAMIC);
  const bpInterface = new (J as any).BroadPhaseLayerInterfaceTable(NUM_OBJECT_LAYERS, NUM_OBJECT_LAYERS);
  bpInterface.MapObjectToBroadPhaseLayer(COLLISION_LAYERS.STATIC, new (J as any).BroadPhaseLayer(0));
  bpInterface.MapObjectToBroadPhaseLayer(COLLISION_LAYERS.DYNAMIC, new (J as any).BroadPhaseLayer(1));
  settings.mObjectLayerPairFilter = objectFilter;
  settings.mBroadPhaseLayerInterface = bpInterface;
  settings.mObjectVsBroadPhaseLayerFilter = new (J as any).ObjectVsBroadPhaseLayerFilterTable(
    bpInterface,
    NUM_OBJECT_LAYERS,
    objectFilter,
    NUM_OBJECT_LAYERS,
  );
  const joltInterface = new (J as any).JoltInterface(settings);
  const physicsSystem = (joltInterface as any).GetPhysicsSystem();
  const bodyInterface = (physicsSystem as any).GetBodyInterface();
  return { jolt: J, joltInterface, physicsSystem, bodyInterface };
}
