import type {
  HostedToolEvent,
  HostedToolFailedEvent,
  HostedToolFinishedEvent,
  HostedToolOutputEvent,
  HostedToolSourceSummary,
  HostedToolStartedEvent,
} from '../../shared/chat/index.js';
import { normalizeToolInvocationPart } from '../../shared/chat/index.js';

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

function clip(value: string, max = 200): string {
  if (value.length <= max) return value;
  return value.slice(0, max - 1) + '\u2026';
}

function summarizePayload(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string') return clip(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return clip(JSON.stringify(value));
  } catch {
    return undefined;
  }
}

function extractSourceSummaries(value: unknown): HostedToolSourceSummary[] | undefined {
  if (!isRecord(value)) return undefined;
  const sources = value.sources;
  if (!Array.isArray(sources)) return undefined;

  const out: HostedToolSourceSummary[] = [];
  for (const entry of sources) {
    if (!isRecord(entry)) continue;
    const url = typeof entry.url === 'string' ? entry.url : undefined;
    const title = typeof entry.title === 'string' ? entry.title : undefined;
    const snippet = typeof entry.snippet === 'string'
      ? entry.snippet
      : typeof entry.text === 'string'
        ? entry.text
        : undefined;
    if (!url && !title && !snippet) continue;
    out.push({ url, title, snippet: snippet ? clip(snippet, 240) : undefined });
  }
  return out.length > 0 ? out : undefined;
}

export interface MapToolPartsInput {
  readonly runId: string;
  readonly messageId?: string;
  readonly provider: string;
  readonly parts: readonly unknown[];
  /** Starting sequence number; defaults to 0. */
  readonly startSequence?: number;
  readonly emittedAt?: string;
}

/**
 * Translate a list of AI SDK message parts (tool calls + tool results) into
 * normalized `HostedToolEvent`s. Each unique `toolCallId` produces a started
 * event followed by either a finished or failed event.
 *
 * This is intentionally a pure mapping over the part shapes returned by the
 * AI SDK so the same code path works for live streams (passing in the latest
 * part array) and persisted transcripts (replaying stored parts).
 */
export function mapPartsToHostedToolEvents(
  input: MapToolPartsInput,
): HostedToolEvent[] {
  const events: HostedToolEvent[] = [];
  const seenStarts = new Set<string>();
  let sequence = input.startSequence ?? 0;
  const emittedAt = input.emittedAt ?? new Date().toISOString();

  for (const part of input.parts) {
    const invocation = normalizeToolInvocationPart(part);
    if (!invocation) continue;

    const base = {
      eventId: `${input.runId}:${invocation.toolCallId}`,
      runId: input.runId,
      messageId: input.messageId,
      toolCallId: invocation.toolCallId,
      toolName: invocation.toolName,
      provider: input.provider,
      emittedAt,
    } as const;

    if (!seenStarts.has(invocation.toolCallId)) {
      seenStarts.add(invocation.toolCallId);
      const started: HostedToolStartedEvent = {
        ...base,
        eventId: `${base.eventId}:started`,
        kind: 'tool-call-started',
        sequence: sequence++,
        inputSummary: summarizePayload(invocation.input),
      };
      events.push(started);
    }

    if (invocation.state === 'error' && invocation.errorText) {
      const failed: HostedToolFailedEvent = {
        ...base,
        eventId: `${base.eventId}:failed`,
        kind: 'tool-call-failed',
        sequence: sequence++,
        errorSummary: clip(invocation.errorText, 240),
      };
      events.push(failed);
      continue;
    }

    if (invocation.state === 'output-available') {
      const finished: HostedToolFinishedEvent = {
        ...base,
        eventId: `${base.eventId}:finished`,
        kind: 'tool-call-finished',
        sequence: sequence++,
        resultSummary: summarizePayload(invocation.output),
        sources: extractSourceSummaries(invocation.output),
      };
      events.push(finished);
      continue;
    }

    if (invocation.output != null) {
      const output: HostedToolOutputEvent = {
        ...base,
        eventId: `${base.eventId}:output:${sequence}`,
        kind: 'tool-call-output',
        sequence: sequence++,
        outputSummary: summarizePayload(invocation.output),
        sources: extractSourceSummaries(invocation.output),
      };
      events.push(output);
    }
  }

  return events;
}
