import type { ModelMessage } from 'ai';
import type { ChatToolInvocation } from '../../shared/chat/index.js';
import { normalizeToolInvocationPart } from '../../shared/chat/index.js';

function mergeInvocations(
  existing: ChatToolInvocation | undefined,
  next: ChatToolInvocation,
): ChatToolInvocation {
  if (!existing) {
    return next;
  }

  return {
    ...existing,
    ...next,
    input: next.input ?? existing.input,
    output: next.output ?? existing.output,
    errorText: next.errorText ?? existing.errorText,
    providerExecuted: next.providerExecuted ?? existing.providerExecuted,
  };
}

function collectInvocations(
  parts: readonly unknown[],
  orderedIds: string[],
  byId: Map<string, ChatToolInvocation>,
): void {
  for (const part of parts) {
    const invocation = normalizeToolInvocationPart(part);
    if (!invocation) {
      continue;
    }

    if (!byId.has(invocation.toolCallId)) {
      orderedIds.push(invocation.toolCallId);
    }

    byId.set(
      invocation.toolCallId,
      mergeInvocations(byId.get(invocation.toolCallId), invocation),
    );
  }
}

export function extractToolInvocationsFromResponseMessages(
  responseMessages: readonly ModelMessage[] | undefined,
): ChatToolInvocation[] {
  if (!responseMessages?.length) {
    return [];
  }

  const orderedIds: string[] = [];
  const byId = new Map<string, ChatToolInvocation>();

  for (const message of responseMessages) {
    if (!Array.isArray(message.content)) {
      continue;
    }

    collectInvocations(message.content, orderedIds, byId);
  }

  return orderedIds
    .map((toolCallId) => byId.get(toolCallId))
    .filter((invocation): invocation is ChatToolInvocation => invocation != null);
}

export function extractToolInvocationsFromParts(
  parts: readonly unknown[] | undefined,
): ChatToolInvocation[] {
  if (!parts?.length) {
    return [];
  }

  const orderedIds: string[] = [];
  const byId = new Map<string, ChatToolInvocation>();

  collectInvocations(parts, orderedIds, byId);

  return orderedIds
    .map((toolCallId) => byId.get(toolCallId))
    .filter((invocation): invocation is ChatToolInvocation => invocation != null);
}
