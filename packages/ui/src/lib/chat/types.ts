export type AgentSource = 'system' | 'user';
export type ChatMessageRole = 'user' | 'assistant' | 'system';

export type AttachmentClassification = 'text' | 'image' | 'pdf' | 'video' | 'unsupported';
export type AttachmentStatus = 'pending' | 'ready' | 'unavailable' | 'rejected';

export interface AttachmentRef {
	readonly id: string;
	readonly messageId: string;
	readonly type: AttachmentClassification;
	readonly name: string;
	readonly mimeType: string;
	readonly path?: string;
	readonly inlineDataBase64?: string;
	readonly size: number;
	readonly lastModified: string;
	readonly status: AttachmentStatus;
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

export interface HostedToolInfo {
	readonly name: string;
	readonly label: string;
	readonly family: string;
	readonly enabled: boolean;
}

export type ToolInvocationAccent =
	| 'sky'
	| 'emerald'
	| 'violet'
	| 'amber'
	| 'rose'
	| 'teal'
	| 'indigo'
	| 'slate';

export type ToolInvocationIconName =
	| 'web-search'
	| 'web-fetch'
	| 'image-generation'
	| 'code-execution'
	| 'code-interpreter'
	| 'file-search'
	| 'google-search'
	| 'url-context'
	| 'google-maps'
	| 'tool';

export type ToolInvocationDetailSection =
	| 'summary'
	| 'query'
	| 'sources'
	| 'url'
	| 'preview'
	| 'code'
	| 'files'
	| 'location'
	| 'input'
	| 'output'
	| 'raw';

export interface AssistantTextPart {
	readonly type: 'text';
	readonly text: string;
}

export interface AssistantImagePart {
	readonly type: 'image';
	readonly url: string;
	readonly mimeType?: string;
	readonly name?: string;
	readonly alt?: string;
}

export interface AssistantFilePart {
	readonly type: 'file';
	readonly url: string;
	readonly mimeType?: string;
	readonly name: string;
}

export type AssistantMessagePart =
	| AssistantTextPart
	| AssistantImagePart
	| AssistantFilePart;

export interface ChatAgentProfile {
	readonly id: string;
	readonly name: string;
	readonly description: string;
	readonly source: AgentSource;
	readonly isInherited: boolean;
	readonly isDuplicatedFromSystem?: boolean;
	readonly isStandalone: boolean;
	readonly isEditable: boolean;
	readonly modelCard: {
		readonly label: string;
		readonly registryId: string;
		readonly uiPresentation: ModelUiPresentation;
		readonly nativeTools?: readonly string[];
		readonly nativeToolSupportLevel?: 'none' | 'hosted' | 'host-executed';
		readonly capabilities?: {
			readonly tools?: boolean;
		};
		readonly toolPolicy?: {
			readonly defaultEnabledTools?: readonly string[];
			readonly removableTools?: readonly string[];
			readonly modelSpecificToolAdditions?: readonly string[];
		};
	};
	readonly toolsEnabled: boolean;
	readonly toolState: Record<string, boolean>;
}

export type ToolInvocationState =
	| 'input-streaming'
	| 'input-available'
	| 'output-available'
	| 'error'
	| 'approval-requested'
	| 'approval-responded';

export interface ToolInvocationInfo {
	readonly toolCallId: string;
	readonly toolName: string;
	readonly state: ToolInvocationState;
	readonly input: unknown;
	readonly output: unknown;
	readonly errorText?: string;
	readonly providerExecuted?: boolean;
}

export interface ToolInvocationAvailabilityInfo {
	readonly toolName: string;
	readonly label: string;
	readonly family: string;
	readonly supported: boolean;
	readonly enabled: boolean;
}

export interface ToolInvocationPresentation {
	readonly toolName: string;
	readonly label: string;
	readonly shortLabel: string;
	readonly family: string;
	readonly icon: ToolInvocationIconName;
	readonly accent: ToolInvocationAccent;
	readonly description: string;
	readonly availabilityDescription: string;
	readonly emptyInputText: string;
	readonly emptyOutputText: string;
	readonly detailSections: readonly ToolInvocationDetailSection[];
}
