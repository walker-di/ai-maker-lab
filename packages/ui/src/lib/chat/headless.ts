// Headless chat barrel for server / bun composition code.
//
// Re-exports only the chat types and pure utilities that have no Svelte
// component dependencies, so importers do not transitively pull in
// `bits-ui`, `paneforge`, or any other browser-only UI library. Use this
// from `apps/desktop-app/src/bun/**` and `apps/desktop-app/src/lib/server/**`
// (and any other Bun-bundled module) instead of `'ui/source'`.

export type {
	AgentSource as ChatAgentSource,
	AssistantFilePart as ChatAssistantFilePart,
	AssistantImagePart as ChatAssistantImagePart,
	AssistantMessagePart as ChatAssistantMessagePart,
	AssistantTextPart as ChatAssistantTextPart,
	AttachmentClassification as ChatAttachmentClassification,
	AttachmentStatus as ChatAttachmentStatus,
	AttachmentRef as ChatAttachmentRef,
	ChatThread as ChatThreadType,
	ChatAgentProfile,
	ModelUiPresentation as ChatModelUiPresentation,
	ChatMessageRole,
	HostedToolInfo as ChatHostedToolInfo,
	ToolInvocationInfo as ChatToolInvocationInfo,
	ToolInvocationState as ChatToolInvocationState,
	ToolInvocationAvailabilityInfo as ChatToolInvocationAvailabilityInfo,
	ToolInvocationPresentation as ChatToolInvocationPresentation,
} from './types.js';

export {
	extractAssistantAssetParts,
	getAssistantPreviewImageUrl,
	getToolAssetExtractionOptions,
} from './tool-asset-parts.js';
