import type { ModelCard } from './model-card.js';

export type AgentSource = 'system' | 'user';

export interface SystemAgentDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly modelCard: ModelCard;
  readonly systemPrompt: string;
  /**
   * Master switch for hosted tool support on this agent. When explicitly
   * `false`, hosted tools are disabled regardless of `defaultToolState`.
   * When omitted, defaults to `true` (tools enabled if the model card
   * supports hosted tools). Per-tool toggles live in `defaultToolState`.
   */
  readonly toolsEnabled?: boolean;
  readonly defaultToolState: Record<string, boolean>;
  readonly metadata: Record<string, unknown>;
}

export interface UserAgentOverrides {
  readonly name?: string;
  readonly description?: string;
  readonly [key: string]: unknown;
}

export interface StoredUserAgent {
  readonly id: string;
  readonly source: 'user';
  readonly inheritsFromSystemAgentId?: string;
  readonly duplicatedFromSystemAgentId?: string;
  readonly modelCardId: string;
  readonly systemPrompt: string;
  /**
   * Effective master switch for hosted tools when explicitly set on the user
   * agent. When omitted, the value inherits from the system agent (if any)
   * or defaults to `true`. Per-tool toggles live in `toolOverrides`.
   */
  readonly toolsEnabled?: boolean;
  readonly toolOverrides: Record<string, boolean>;
  readonly userOverrides: UserAgentOverrides;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ResolvedAgentProfile {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly source: AgentSource;
  readonly systemAgentId?: string;
  readonly inheritsFromSystemAgentId?: string;
  readonly isInherited: boolean;
  readonly isDuplicatedFromSystem?: boolean;
  readonly isStandalone: boolean;
  readonly isEditable: boolean;
  readonly modelCard: ModelCard;
  readonly systemPrompt: string;
  /**
   * Effective master switch for hosted tools after merging system + user
   * overrides. When `false`, hosted tools are disabled even if individual
   * entries in `toolState` are `true`. When `true` or omitted (defaults to
   * true), per-tool decisions in `toolState` apply.
   */
  readonly toolsEnabled: boolean;
  readonly toolState: Record<string, boolean>;
  readonly metadata: Record<string, unknown>;
}
