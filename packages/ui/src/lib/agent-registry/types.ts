export type AgentRegistrySource = 'system' | 'user';
export type AgentRegistryStatus = 'system' | 'inherited' | 'duplicated' | 'custom';
export type AgentRegistrySourceFilter = 'all' | AgentRegistrySource;
export type AgentRegistryStatusFilter = 'all' | AgentRegistryStatus;

export interface AgentRegistryModelUiPresentation {
	readonly badges: readonly string[];
	readonly warnings: readonly string[];
	readonly disabledComposerControls: readonly string[];
	readonly fallbackHints: readonly string[];
	readonly hiddenToolToggles: readonly string[];
}

export interface AgentRegistryModelCard {
	readonly familyId?: string;
	readonly provider?: string;
	readonly registryId: string;
	readonly label: string;
	readonly description?: string;
	readonly uiPresentation: AgentRegistryModelUiPresentation;
	readonly nativeTools?: readonly string[];
	readonly nativeToolFamilies?: readonly string[];
}

export interface AgentRegistryAgent {
	readonly id: string;
	readonly name: string;
	readonly description: string;
	readonly source: AgentRegistrySource;
	readonly systemAgentId?: string;
	readonly inheritsFromSystemAgentId?: string;
	readonly isInherited: boolean;
	readonly isDuplicatedFromSystem?: boolean;
	readonly isStandalone: boolean;
	readonly isEditable: boolean;
	readonly systemPrompt: string;
	readonly toolState?: Record<string, boolean>;
	readonly modelCard: AgentRegistryModelCard;
}

export interface AgentRegistryEditorDraft {
	readonly name: string;
	readonly description: string;
	readonly systemPrompt: string;
	readonly modelCardId: string;
	readonly toolState: Record<string, boolean>;
}

export interface AgentRegistryModelOption {
	readonly registryId: string;
	readonly label: string;
	readonly provider: string;
	readonly description?: string;
}

export interface AgentRegistryToolOption {
	readonly key: string;
	readonly label: string;
	readonly enabled: boolean;
}
