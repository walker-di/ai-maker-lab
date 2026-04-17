import type { HostedNativeToolName } from './model-native-tools.js';
/**
 * Inputs available to a `ModelToolPolicyHook` so it can reshape the resolved
 * hosted tool set per request without exposing AI SDK runtime types in the
 * shared layer. The hook is intentionally a pure function over browser-safe
 * data so it can be evaluated identically on the server and in any tooling
 * that needs to predict the effective tool set.
 */
export interface ModelToolPolicyHookInput {
    readonly enabledTools: readonly HostedNativeToolName[];
    readonly providerOptions: Record<string, unknown>;
    readonly hasAttachments: boolean;
    readonly attachmentClassifications: readonly string[];
}
/**
 * Result returned by a tool policy hook to add, remove, or override tools or
 * provider options. Returning `undefined` keeps the resolved value unchanged.
 */
export interface ModelToolPolicyHookResult {
    readonly addedTools?: readonly HostedNativeToolName[];
    readonly removedTools?: readonly HostedNativeToolName[];
    readonly providerOptionOverrides?: Record<string, unknown>;
}
export type ModelToolPolicyHook = (input: ModelToolPolicyHookInput) => ModelToolPolicyHookResult | undefined;
export interface ModelToolPolicy {
    readonly defaultEnabledTools: readonly HostedNativeToolName[];
    readonly removableTools: readonly HostedNativeToolName[];
    readonly modelSpecificToolAdditions: readonly HostedNativeToolName[];
    readonly providerOptionPresets: Record<string, unknown>;
    readonly hostedToolConfigs: Partial<Record<HostedNativeToolName, unknown>>;
    /**
     * Optional hook invoked at request time after defaults/overrides resolve.
     * Used to add fallback hosted tools or strip unsupported ones based on
     * request inputs (e.g. presence of attachments). Defaults to a no-op.
     */
    readonly hook?: ModelToolPolicyHook;
}
export declare const DEFAULT_TOOL_POLICY: ModelToolPolicy;
