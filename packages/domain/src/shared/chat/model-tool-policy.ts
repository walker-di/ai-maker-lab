export interface ModelToolPolicy {
  readonly defaultEnabledTools: readonly string[];
  readonly removableTools: readonly string[];
  readonly modelSpecificToolAdditions: readonly string[];
  readonly providerOptionPresets: Record<string, unknown>;
}

export const DEFAULT_TOOL_POLICY: ModelToolPolicy = {
  defaultEnabledTools: [],
  removableTools: [],
  modelSpecificToolAdditions: [],
  providerOptionPresets: {},
};
