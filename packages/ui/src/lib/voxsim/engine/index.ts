export { VoxsimEngine } from './VoxsimEngine.js';
export type { EngineMode, VoxsimEngineConfig } from './VoxsimEngine.js';

export { EngineEmitter } from './events.js';
export type { EngineEvent, EngineEventListener, EngineEventMap } from './events.js';

export { EngineWorld, SystemEventBus } from './world.js';
export type {
  ComponentKind,
  Entity,
  System,
  SystemContext,
  SystemEvent,
} from './world.js';

export { FixedStepLoop } from './fixed-step-loop.js';
export type { FixedStepLoopOptions } from './fixed-step-loop.js';

export {
  COMPONENT_KINDS,
} from './components.js';
export type {
  CameraComponent,
  CameraKind,
  ComponentName,
  LightComponent,
  LightKind,
  RenderMeshComponent,
  TransformComponent,
} from './components.js';

export {
  AssetRegistry,
  DEFAULT_BUNDLE,
} from './asset-registry.js';
export type {
  AssetBundle,
  MeshTemplate,
  SkyboxDescriptor,
  VoxelMaterialConfig,
} from './asset-registry.js';

export {
  ChunkMeshBuilder,
  chunkTotalVoxels,
  countVoxelsByKind,
} from './chunk-mesh-builder.js';
export type {
  ChunkMeshBuilderOptions,
  ChunkMeshEntry,
  ChunkMeshes,
} from './chunk-mesh-builder.js';

export {
  attachSceneLayers,
  disposeSceneLayers,
} from './layers.js';
export type { SceneLayers } from './layers.js';

export { OrbitCamera } from './camera.js';

export { emptyRenderSnapshot } from './render-snapshot.js';
export type { RenderSnapshot, RenderSnapshotEntity } from './render-snapshot.js';

export {
  NullRenderer,
  createWebRendererFactory,
} from './renderer.js';
export type { EngineRenderer, WebRendererOptions } from './renderer.js';

export {
  ScriptedInputSource,
  createEmptyInputState,
} from './input.js';
export type { InputSource, InputState } from './input.js';

export {
  ChunkColliderBuilder,
  JoltSystem,
  NullPhysicsSystem,
  loadJolt,
  buildSurfaceMeshShape,
  buildCompoundBoxShape,
  buildHeightFieldShape,
  isHeightfieldShape,
  countSolidVoxels,
  defaultPhysicsConfig,
  cloneVec3 as physicsCloneVec3,
  cloneQuat as physicsCloneQuat,
  cloneTransform as physicsCloneTransform,
} from './physics/index.js';
export type {
  BodyHandle,
  BodyKind,
  BodySpec,
  ConstraintHandle,
  ConstraintSpec,
  DebugLineSegment,
  IPhysicsSystem,
  JoltLoaderOptions,
  JoltRuntime,
  MotorMode,
  MotorParams,
  MotorTarget,
  OverlapHit,
  PhysicsBodySnapshot,
  PhysicsConfig,
  PhysicsLayer,
  PhysicsLayerFilter,
  PhysicsSnapshot,
  RayHit,
  RotationLimits,
  ShapeHandle,
  ShapeQuery,
  ShapeSpec,
  SixDofMotors,
  TranslationLimits,
} from './physics/index.js';
export type {
  ChunkColliderBuilderOptions,
  ChunkColliderResult,
} from './physics/chunk-collider.js';
