export type { LineageRef } from './lineage.js';

export type {
  ActuatorEntry,
  ActuatorMap,
  ActuatorMode,
  ActuatorRange,
} from './actuator-map.js';

export type {
  JointSpec,
  MotorMode,
  MotorSpec,
  SegmentRotationLimits,
  SegmentTranslationLimits,
  SixDofMotorAxis,
  SixDofMotorSpecs,
} from './joint-spec.js';
export { motorsOf } from './joint-spec.js';

export type { SensorKind, SensorSpec } from './sensor-spec.js';
export { outputWidth } from './sensor-spec.js';

export type {
  BodyDna,
  BodyDnaMetadata,
  DeathRule,
  OrganismKind,
  SegmentShapeSpec,
  SegmentSpec,
} from './body-dna.js';

export type {
  BodyDnaValidationIssue,
  BodyDnaValidationResult,
} from './validation.js';
export { validateBodyDna } from './validation.js';
