export interface ModelCapabilityMatrix {
  readonly text: boolean;
  readonly image: boolean;
  readonly file: boolean;
  readonly pdf: boolean;
  readonly video: boolean;
  readonly streaming: boolean;
  readonly tools: boolean;
  readonly replyThreads: boolean;
}

export function supportsModality(
  capabilities: ModelCapabilityMatrix,
  modality: keyof ModelCapabilityMatrix,
): boolean {
  return capabilities[modality];
}
