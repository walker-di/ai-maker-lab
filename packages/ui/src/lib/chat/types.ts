export type AgentSource = 'system' | 'user';
export type ChatMessageRole = 'user' | 'assistant' | 'system';

export interface AttachmentRef {
	readonly id: string;
	readonly messageId: string;
	readonly type: 'image' | 'file' | 'pdf' | 'video' | 'text';
	readonly name: string;
	readonly mimeType: string;
	readonly url?: string;
	readonly content?: string;
}

export interface ChatThread {
	readonly id: string;
	readonly title: string;
	readonly participantIds: readonly string[];
	readonly defaultAgentId?: string;
	readonly createdAt: string;
	readonly updatedAt: string;
}

export interface ModelUiPresentation {
	readonly badges: readonly string[];
	readonly warnings: readonly string[];
	readonly disabledComposerControls: readonly string[];
	readonly fallbackHints: readonly string[];
	readonly hiddenToolToggles: readonly string[];
}

export interface ChatAgentProfile {
	readonly id: string;
	readonly name: string;
	readonly description: string;
	readonly source: AgentSource;
	readonly isInherited: boolean;
	readonly isStandalone: boolean;
	readonly isEditable: boolean;
	readonly modelCard: {
		readonly label: string;
		readonly registryId: string;
		readonly uiPresentation: ModelUiPresentation;
	};
}
