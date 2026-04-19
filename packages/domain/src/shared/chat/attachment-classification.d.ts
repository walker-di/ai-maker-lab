import type { AttachmentClassification } from './chat-types.js';
import type { ModelInputPolicy, ModalityInputPolicy } from './model-input-policy.js';
export declare function classifyMimeType(mimeType: string, fileName: string): AttachmentClassification;
export declare function classificationToModality(classification: AttachmentClassification): keyof ModelInputPolicy;
export declare function getModalityPolicy(inputPolicy: ModelInputPolicy, classification: AttachmentClassification): ModalityInputPolicy;
