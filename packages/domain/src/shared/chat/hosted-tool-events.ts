/**
 * Normalized hosted-tool lifecycle events that the application layer emits and
 * the UI/transcript can replay without leaking provider-specific payloads.
 *
 * Plan 05 §105–117 requires four event kinds (`tool-call-started`,
 * `tool-call-output`, `tool-call-finished`, `tool-call-failed`) carrying:
 *  - `runId` (chat run identifier),
 *  - `messageId` (assistant message receiving the tool call, when known),
 *  - `toolName`,
 *  - `provider`,
 *  - concise transcript-safe summaries,
 *  - optional source / citation summaries,
 *  - optional structured payload references for replay.
 *
 * Keep this file browser-safe; no AI SDK or provider runtime types here.
 */

export type HostedToolEventKind =
  | 'tool-call-started'
  | 'tool-call-output'
  | 'tool-call-finished'
  | 'tool-call-failed';

export interface HostedToolSourceSummary {
  /** Short human-readable label (e.g. result title or domain). */
  readonly title?: string;
  /** Public URL for the source. */
  readonly url?: string;
  /** Concise transcript-safe excerpt or description. */
  readonly snippet?: string;
}

export interface HostedToolCitationSummary {
  /** Source the citation refers to (matches a `HostedToolSourceSummary.url`). */
  readonly url?: string;
  /** Optional short title to render in transcripts. */
  readonly title?: string;
}

export interface BaseHostedToolEvent {
  readonly kind: HostedToolEventKind;
  /** Stable event identifier for transcripts and replay. */
  readonly eventId: string;
  /** Identifier of the model run that produced the tool call. */
  readonly runId: string;
  /** Identifier of the assistant message receiving the tool call. */
  readonly messageId?: string;
  /** Identifier of the tool call returned by the provider. */
  readonly toolCallId: string;
  /** Normalized tool name (e.g. `web_search`, `code_interpreter`). */
  readonly toolName: string;
  /** Provider that executed the hosted tool. */
  readonly provider: string;
  /** Transcript-safe ordering hint (monotonic per run). */
  readonly sequence: number;
  /** ISO timestamp the event was emitted. */
  readonly emittedAt: string;
}

export interface HostedToolStartedEvent extends BaseHostedToolEvent {
  readonly kind: 'tool-call-started';
  /** Concise transcript-safe summary of the tool input. */
  readonly inputSummary?: string;
  /** Reference key for the raw input payload, if persisted separately. */
  readonly inputPayloadRef?: string;
}

export interface HostedToolOutputEvent extends BaseHostedToolEvent {
  readonly kind: 'tool-call-output';
  /** Concise transcript-safe summary of the partial/full tool output. */
  readonly outputSummary?: string;
  /** Optional sources surfaced by hosted retrieval/search tools. */
  readonly sources?: readonly HostedToolSourceSummary[];
  /** Optional citations resolved against the surfaced sources. */
  readonly citations?: readonly HostedToolCitationSummary[];
  /** Reference key for the raw output payload, if persisted separately. */
  readonly outputPayloadRef?: string;
}

export interface HostedToolFinishedEvent extends BaseHostedToolEvent {
  readonly kind: 'tool-call-finished';
  /** Transcript-safe summary of the final outcome. */
  readonly resultSummary?: string;
  readonly sources?: readonly HostedToolSourceSummary[];
  readonly citations?: readonly HostedToolCitationSummary[];
  readonly outputPayloadRef?: string;
}

export interface HostedToolFailedEvent extends BaseHostedToolEvent {
  readonly kind: 'tool-call-failed';
  /** Transcript-safe error summary (no provider stack traces). */
  readonly errorSummary: string;
  /** Reference key for the raw error payload, if persisted separately. */
  readonly errorPayloadRef?: string;
}

export type HostedToolEvent =
  | HostedToolStartedEvent
  | HostedToolOutputEvent
  | HostedToolFinishedEvent
  | HostedToolFailedEvent;

export function isHostedToolEvent(value: unknown): value is HostedToolEvent {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<BaseHostedToolEvent>;
  if (
    typeof candidate.kind !== 'string'
    || typeof candidate.eventId !== 'string'
    || typeof candidate.runId !== 'string'
    || typeof candidate.toolCallId !== 'string'
    || typeof candidate.toolName !== 'string'
    || typeof candidate.provider !== 'string'
    || typeof candidate.sequence !== 'number'
    || typeof candidate.emittedAt !== 'string'
  ) {
    return false;
  }

  return (
    candidate.kind === 'tool-call-started'
    || candidate.kind === 'tool-call-output'
    || candidate.kind === 'tool-call-finished'
    || candidate.kind === 'tool-call-failed'
  );
}
