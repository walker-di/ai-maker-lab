import type { ChatToolInvocation, ChatToolInvocationState } from './chat-types.js';
import { resolveToolInvocationOutput } from './tool-invocation-output.js';

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * Normalize the lifecycle state of a tool part. Falls back to derived state
 * (`output-available` / `error` / `input-available`) when no explicit state
 * field is present, so live AI SDK stream parts and persisted invocations
 * resolve to the same set of states.
 */
export function normalizeToolInvocationState(
  part: JsonRecord,
  hasOutput: boolean,
  hasError: boolean,
): ChatToolInvocationState {
  const state = getString(part.state);
  switch (state) {
    case 'input-streaming':
    case 'input-available':
    case 'output-available':
    case 'approval-requested':
    case 'approval-responded':
      return state;
    case 'output-error':
    case 'error':
      return 'error';
    default:
      if (hasError) {
        return 'error';
      }
      return hasOutput ? 'output-available' : 'input-available';
  }
}

export function getToolInvocationName(part: JsonRecord): string | undefined {
  const explicit = getString(part.toolName);
  if (explicit) {
    return explicit;
  }

  const type = getString(part.type);
  if (type?.startsWith('tool-') && type.length > 'tool-'.length) {
    return type.slice('tool-'.length);
  }

  return undefined;
}

/**
 * Convert an AI SDK message/tool part (live stream OR persisted record) into a
 * normalized `ChatToolInvocation`. Single source of truth shared across
 * application extractors and UI/view-model adapters.
 */
export function normalizeToolInvocationPart(part: unknown): ChatToolInvocation | null {
  if (!isRecord(part)) {
    return null;
  }

  const type = getString(part.type);
  if (
    type !== 'dynamic-tool' &&
    type !== 'tool' &&
    type !== 'tool-call' &&
    type !== 'tool-result' &&
    !type?.startsWith('tool-')
  ) {
    return null;
  }

  const toolCallId = getString(part.toolCallId);
  const toolName = getToolInvocationName(part);
  if (!toolCallId || !toolName) {
    return null;
  }

  const input = part.input ?? part.args;
  const output = resolveToolInvocationOutput(part.output, part.result);
  const errorText =
    getString(part.errorText) ??
    (part.isError === true ? getString(part.result) : undefined);
  const providerExecuted =
    typeof part.providerExecuted === 'boolean' ? part.providerExecuted : undefined;

  return {
    toolCallId,
    toolName,
    state: normalizeToolInvocationState(part, output !== undefined, Boolean(errorText)),
    input,
    output,
    errorText,
    providerExecuted,
  };
}
