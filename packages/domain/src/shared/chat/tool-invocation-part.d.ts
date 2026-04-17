import type { ChatToolInvocation, ChatToolInvocationState } from './chat-types.js';
type JsonRecord = Record<string, unknown>;
/**
 * Normalize the lifecycle state of a tool part. Falls back to derived state
 * (`output-available` / `error` / `input-available`) when no explicit state
 * field is present, so live AI SDK stream parts and persisted invocations
 * resolve to the same set of states.
 */
export declare function normalizeToolInvocationState(part: JsonRecord, hasOutput: boolean, hasError: boolean): ChatToolInvocationState;
export declare function getToolInvocationName(part: JsonRecord): string | undefined;
/**
 * Convert an AI SDK message/tool part (live stream OR persisted record) into a
 * normalized `ChatToolInvocation`. Single source of truth shared across
 * application extractors and UI/view-model adapters.
 */
export declare function normalizeToolInvocationPart(part: unknown): ChatToolInvocation | null;
export {};
