export type InputPolicyOutcome =
  | 'pass-through'
  | 'transform'
  | 'augment-with-tools'
  | 'reject';

export interface ModalityInputPolicy {
  readonly outcome: InputPolicyOutcome;
  readonly reason?: string;
}

export interface ModelInputPolicy {
  readonly text: ModalityInputPolicy;
  readonly image: ModalityInputPolicy;
  readonly pdf: ModalityInputPolicy;
  readonly file: ModalityInputPolicy;
  readonly video: ModalityInputPolicy;
}

const PASS_THROUGH: ModalityInputPolicy = { outcome: 'pass-through' };
const REJECT_UNSUPPORTED: ModalityInputPolicy = {
  outcome: 'reject',
  reason: 'Modality not supported by this model.',
};

export const DEFAULT_INPUT_POLICY: ModelInputPolicy = {
  text: PASS_THROUGH,
  image: PASS_THROUGH,
  pdf: PASS_THROUGH,
  file: PASS_THROUGH,
  video: REJECT_UNSUPPORTED,
};

export const VIDEO_CAPABLE_INPUT_POLICY: ModelInputPolicy = {
  text: PASS_THROUGH,
  image: PASS_THROUGH,
  pdf: PASS_THROUGH,
  file: PASS_THROUGH,
  video: PASS_THROUGH,
};
