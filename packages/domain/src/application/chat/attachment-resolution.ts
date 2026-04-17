import type { AttachmentRef, AttachmentClassification } from '../../shared/chat/index.js';
import type { InputPolicyOutcome, ModalityInputPolicy } from '../../shared/chat/index.js';

export type ResolvedContentPart =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'image'; readonly data: Uint8Array; readonly mimeType: string }
  | { readonly type: 'file'; readonly data: Uint8Array; readonly mimeType: string };

export interface AttachmentResolutionResult {
  readonly attachment: AttachmentRef;
  readonly classification: AttachmentClassification;
  readonly policyOutcome: InputPolicyOutcome;
  readonly policyReason?: string;
  readonly contentPart?: ResolvedContentPart;
  readonly rejected: boolean;
  readonly rejectionReason?: string;
}

export interface IAttachmentContentResolver {
  resolve(attachment: AttachmentRef): Promise<ResolvedContentPart | null>;
  checkAvailability(attachment: AttachmentRef): Promise<boolean>;
}
