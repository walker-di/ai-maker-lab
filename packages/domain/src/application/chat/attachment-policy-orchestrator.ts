import type { AttachmentRef, ModelInputPolicy } from '../../shared/chat/index.js';
import { getModalityPolicy } from '../../shared/chat/index.js';
import type {
  IAttachmentContentResolver,
  AttachmentResolutionResult,
  ResolvedContentPart,
} from './attachment-resolution.js';

export async function resolveAttachmentsForModel(
  attachments: readonly AttachmentRef[],
  inputPolicy: ModelInputPolicy,
  resolver: IAttachmentContentResolver,
): Promise<AttachmentResolutionResult[]> {
  const results: AttachmentResolutionResult[] = [];

  for (const attachment of attachments) {
    const result = await resolveOneAttachment(attachment, inputPolicy, resolver);
    results.push(result);
  }

  return results;
}

async function resolveOneAttachment(
  attachment: AttachmentRef,
  inputPolicy: ModelInputPolicy,
  resolver: IAttachmentContentResolver,
): Promise<AttachmentResolutionResult> {
  if (attachment.status === 'unavailable') {
    return {
      attachment,
      classification: attachment.type,
      policyOutcome: 'reject',
      rejected: true,
      rejectionReason: 'File is no longer available.',
    };
  }

  if (attachment.type === 'unsupported') {
    return {
      attachment,
      classification: 'unsupported',
      policyOutcome: 'reject',
      rejected: true,
      rejectionReason: 'File type is not supported.',
    };
  }

  const policy = getModalityPolicy(inputPolicy, attachment.type);

  if (policy.outcome === 'reject') {
    return {
      attachment,
      classification: attachment.type,
      policyOutcome: 'reject',
      policyReason: policy.reason,
      rejected: true,
      rejectionReason: policy.reason ?? 'Input rejected by model policy.',
    };
  }

  const isAvailable = await resolver.checkAvailability(attachment);
  if (!isAvailable) {
    return {
      attachment,
      classification: attachment.type,
      policyOutcome: policy.outcome,
      rejected: true,
      rejectionReason: 'File not found or unreadable.',
    };
  }

  if (policy.outcome === 'transform') {
    return {
      attachment,
      classification: attachment.type,
      policyOutcome: 'transform',
      policyReason: policy.reason,
      rejected: false,
    };
  }

  if (policy.outcome === 'augment-with-tools') {
    return {
      attachment,
      classification: attachment.type,
      policyOutcome: 'augment-with-tools',
      policyReason: policy.reason,
      rejected: false,
    };
  }

  let contentPart: ResolvedContentPart | null = null;
  try {
    contentPart = await resolver.resolve(attachment);
  } catch {
    return {
      attachment,
      classification: attachment.type,
      policyOutcome: 'pass-through',
      rejected: true,
      rejectionReason: 'Failed to read file content.',
    };
  }

  if (!contentPart) {
    return {
      attachment,
      classification: attachment.type,
      policyOutcome: 'pass-through',
      rejected: true,
      rejectionReason: 'Resolver returned no content.',
    };
  }

  return {
    attachment,
    classification: attachment.type,
    policyOutcome: 'pass-through',
    contentPart,
    rejected: false,
  };
}

export function hasRejections(results: readonly AttachmentResolutionResult[]): boolean {
  return results.some((r) => r.rejected);
}

export function getContentParts(
  results: readonly AttachmentResolutionResult[],
): ResolvedContentPart[] {
  return results
    .filter((r) => !r.rejected && r.contentPart != null)
    .map((r) => r.contentPart!);
}
