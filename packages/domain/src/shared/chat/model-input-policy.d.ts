export type InputPolicyOutcome = 'pass-through' | 'transform' | 'augment-with-tools' | 'reject';
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
export declare const DEFAULT_INPUT_POLICY: ModelInputPolicy;
export declare const VIDEO_CAPABLE_INPUT_POLICY: ModelInputPolicy;
