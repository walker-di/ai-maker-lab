/**
 * Racing engine public API. The route imports the namespaced
 * `Racing.Engine.RacingEngine` to mount a simulation, plus `RacingRenderer`
 * and `CameraRig` for the rendering / camera glue. Pure physics math is
 * grouped under `Physics`; track-geometry helpers under `Tracks`.
 */

export * as Physics from './physics/index.js';
export * as Tracks from './tracks/index.js';
export * as Validation from './validation/gt3-physics-bench.js';

export { RacingEngine } from './RacingEngine.js';
export type {
  RacingEngineConfig,
  RacingEngineSnapshot,
  RacingTelemetryExport,
  RacingTelemetrySample,
  RacingTelemetryWheelSample,
} from './RacingEngine.js';
export { CameraRig, CAMERA_MODES, type CameraMode } from './cameras.js';
export { FixedStepLoop, type FixedStepLoopOptions } from './fixed-step-loop.js';
export { RacingRenderer, type ChassisPose, type WheelPose, type RacingRendererOptions } from './three-renderer.js';
export { RacingInput, type RacingInputState, type RacingInputOptions } from './input.js';
export { NullAudioBus, type AudioBus } from './audio-bus.js';
export {
  EngineEmitter,
  type EngineEventMap,
  type LapFinishedPayload,
  type LapStartedPayload,
  type TickPayload,
  type WheelEventPayload,
  type FfbRackForcePayload,
} from './events.js';
export { loadJolt, createPhysicsContext, COLLISION_LAYERS, NUM_OBJECT_LAYERS, type PhysicsContext } from './jolt-loader.js';
export {
  resolveCompliance,
  hasCompliance,
  createChassisBody,
  createHubBodies,
  createComplianceConstraints,
  destroyComplianceBodies,
  readJoltBodyPose,
  writeJoltBodyPose,
  createSoftwareHubStates,
  stepComplianceSoftware,
  applyTorsionalRestoringTorque,
  applyTorsionalRestoringTorqueToVector,
  type ResolvedCompliance,
  type JoltHubBodies,
  type SoftwareHubState,
} from './compliance.js';
