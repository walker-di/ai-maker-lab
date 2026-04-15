import type { ModelCard } from './model-card.js';

export type AgentSource = 'system' | 'user';

export interface SystemAgentDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly modelCard: ModelCard;
  readonly systemPrompt: string;
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
  readonly modelCardId: string;
  readonly systemPrompt: string;
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
  readonly isStandalone: boolean;
  readonly isEditable: boolean;
  readonly modelCard: ModelCard;
  readonly systemPrompt: string;
  readonly toolState: Record<string, boolean>;
  readonly metadata: Record<string, unknown>;
}
