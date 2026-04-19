// MotorMode intentionally not re-exported here to avoid colliding with the
// physics-layer `MotorMode` already exported from `engine/index.js`. Import
// the morphology variant directly from `voxsim/morphology/types.js` if needed.
export type {
  ActuatorEntry,
  ActuatorMap,
  ActuatorMode,
  ActuatorRange,
  BodyDna,
  BodyDnaMetadata,
  DeathRule,
  JointSpec,
  LineageRef,
  MotorSpec,
  OrganismKind,
  SegmentRotationLimits,
  SegmentShapeSpec,
  SegmentSpec,
  SegmentTranslationLimits,
  SensorKind,
  SensorSpec,
  SixDofMotorAxis,
  SixDofMotorSpecs,
} from './types.js';
export { motorsOf, outputWidth } from './types.js';

export {
  MORPHOLOGY_COMPONENT_KINDS,
  type ActuatorEntryRuntime,
  type ActuatorsComponent,
  type AgentComponent,
  type JointEntry,
  type JointsComponent,
  type MorphologyComponentKind,
  type SegmentEntry,
  type SegmentsComponent,
  type SensorEntry,
  type SensorsComponent,
} from './components.js';

export {
  MorphologyBuilder,
  composeTransform,
  type AgentHandle,
  type MorphologyBuilderOptions,
} from './MorphologyBuilder.js';

export { SensorSystem, type SensorSystemOptions } from './SensorSystem.js';
export { ActuatorSystem, type ActuatorSystemOptions } from './ActuatorSystem.js';

export {
  DeathEvaluator,
  type DeathEvaluatorOptions,
  type DeathFiringResult,
} from './death.js';

export {
  createBipedDna,
  createQuadrupedDna,
  createSnakeDna,
} from './library/index.js';
