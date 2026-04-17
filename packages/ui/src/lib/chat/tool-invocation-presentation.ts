import type {
	ChatAgentProfile,
	HostedToolInfo,
	ToolInvocationAvailabilityInfo,
	ToolInvocationInfo,
	ToolInvocationPresentation,
} from './types.js';

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
	return typeof value === 'object' && value !== null;
}

function getString(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function getStringFromKeys(record: JsonRecord, keys: readonly string[]): string | undefined {
	for (const key of keys) {
		const value = getString(record[key]);
		if (value) {
			return value;
		}
	}
	return undefined;
}

function getArrayLength(value: unknown): number | null {
	return Array.isArray(value) ? value.length : null;
}

function asRecord(value: unknown): JsonRecord | null {
	return isRecord(value) ? value : null;
}

function getOutputRecord(invocation: ToolInvocationInfo): JsonRecord | null {
	return asRecord(invocation.output);
}

function extractQuery(invocation: ToolInvocationInfo): string | undefined {
	const input = asRecord(invocation.input);
	const output = getOutputRecord(invocation);
	return (
		input && getStringFromKeys(input, ['query', 'prompt', 'url', 'location', 'city', 'address'])
	) ?? (
		output && getStringFromKeys(output, ['query', 'prompt', 'url', 'location', 'city', 'address'])
	) ?? undefined;
}

function summarizeCount(label: string, count: number | null): string | undefined {
	if (count == null) {
		return undefined;
	}
	return `${count} ${label}${count === 1 ? '' : 's'}`;
}

function summarizeOutputCount(invocation: ToolInvocationInfo, keys: readonly string[]): string | undefined {
	const output = getOutputRecord(invocation);
	if (!output) {
		return undefined;
	}
	for (const key of keys) {
		const count = getArrayLength(output[key]);
		if (count != null) {
			return summarizeCount(key.replace(/s$/, ''), count);
		}
	}
	return undefined;
}

function summarizeWebSearch(invocation: ToolInvocationInfo): string | undefined {
	return summarizeOutputCount(invocation, ['sources', 'results']) ?? extractQuery(invocation);
}

function summarizeWebFetch(invocation: ToolInvocationInfo): string | undefined {
	return extractQuery(invocation) ?? summarizeOutputCount(invocation, ['content', 'sections']);
}

function summarizeImageGeneration(invocation: ToolInvocationInfo): string | undefined {
	return extractQuery(invocation) ?? summarizeOutputCount(invocation, ['images']);
}

function summarizeCode(invocation: ToolInvocationInfo): string | undefined {
	const output = getOutputRecord(invocation);
	const summary =
		(output && getStringFromKeys(output, ['stdout', 'stderr', 'message'])) ??
		extractQuery(invocation);
	return summary ? summary.slice(0, 48) : undefined;
}

function summarizeFileSearch(invocation: ToolInvocationInfo): string | undefined {
	return summarizeOutputCount(invocation, ['files', 'matches', 'results']) ?? extractQuery(invocation);
}

function summarizeMaps(invocation: ToolInvocationInfo): string | undefined {
	return extractQuery(invocation) ?? summarizeOutputCount(invocation, ['places', 'results']);
}

export const TOOL_INVOCATION_PRESENTATIONS: Record<string, ToolInvocationPresentation> = {
	web_search: {
		toolName: 'web_search',
		label: 'Web Search',
		shortLabel: 'Sources',
		family: 'search',
		icon: 'web-search',
		accent: 'sky',
		description: 'Searches the web and collects relevant sources for the assistant.',
		availabilityDescription: 'Uses the model hosted search capability for live web discovery.',
		emptyInputText: 'No search query was captured for this run.',
		emptyOutputText: 'No search results were returned.',
		detailSections: ['summary', 'query', 'sources', 'output', 'raw'],
	},
	web_fetch: {
		toolName: 'web_fetch',
		label: 'Web Fetch',
		shortLabel: 'Fetch',
		family: 'urlContext',
		icon: 'web-fetch',
		accent: 'teal',
		description: 'Fetches a page or document and extracts content for the assistant to read.',
		availabilityDescription: 'Uses the model hosted fetch capability to read URL content directly.',
		emptyInputText: 'No target URL was captured for this fetch.',
		emptyOutputText: 'No fetched content was returned.',
		detailSections: ['summary', 'url', 'preview', 'output', 'raw'],
	},
	image_generation: {
		toolName: 'image_generation',
		label: 'Image Generation',
		shortLabel: 'Image',
		family: 'imageGeneration',
		icon: 'image-generation',
		accent: 'violet',
		description: 'Generates one or more images from a prompt.',
		availabilityDescription: 'Uses the model hosted image generation workflow.',
		emptyInputText: 'No image prompt was captured for this generation.',
		emptyOutputText: 'No generated image payload was returned.',
		detailSections: ['summary', 'preview', 'query', 'output', 'raw'],
	},
	code_execution: {
		toolName: 'code_execution',
		label: 'Code Execution',
		shortLabel: 'Run Code',
		family: 'codeExecution',
		icon: 'code-execution',
		accent: 'amber',
		description: 'Runs code in a hosted execution environment for calculation or analysis.',
		availabilityDescription: 'Uses the model hosted code execution sandbox.',
		emptyInputText: 'No code input was captured for execution.',
		emptyOutputText: 'No execution output was returned.',
		detailSections: ['summary', 'code', 'output', 'raw'],
	},
	code_interpreter: {
		toolName: 'code_interpreter',
		label: 'Code Interpreter',
		shortLabel: 'Interpreter',
		family: 'codeExecution',
		icon: 'code-interpreter',
		accent: 'indigo',
		description: 'Runs notebook-style code and may return generated files or rich artifacts.',
		availabilityDescription: 'Uses the model hosted interpreter for analysis and artifact generation.',
		emptyInputText: 'No interpreter input was captured for this run.',
		emptyOutputText: 'No interpreter output was returned.',
		detailSections: ['summary', 'code', 'files', 'output', 'raw'],
	},
	file_search: {
		toolName: 'file_search',
		label: 'File Search',
		shortLabel: 'Files',
		family: 'retrieval',
		icon: 'file-search',
		accent: 'emerald',
		description: 'Searches indexed files and returns matched documents or snippets.',
		availabilityDescription: 'Uses the model hosted retrieval capability against configured files or stores.',
		emptyInputText: 'No file search query was captured for this run.',
		emptyOutputText: 'No file matches were returned.',
		detailSections: ['summary', 'query', 'files', 'output', 'raw'],
	},
	google_search: {
		toolName: 'google_search',
		label: 'Google Search',
		shortLabel: 'Google',
		family: 'search',
		icon: 'google-search',
		accent: 'rose',
		description: 'Searches Google-backed results for fresh web information.',
		availabilityDescription: 'Uses the provider hosted Google search integration.',
		emptyInputText: 'No Google search query was captured for this run.',
		emptyOutputText: 'No Google search results were returned.',
		detailSections: ['summary', 'query', 'sources', 'output', 'raw'],
	},
	url_context: {
		toolName: 'url_context',
		label: 'URL Context',
		shortLabel: 'Context',
		family: 'urlContext',
		icon: 'url-context',
		accent: 'slate',
		description: 'Reads and summarizes the context of a URL for the model.',
		availabilityDescription: 'Uses the provider hosted URL context reader.',
		emptyInputText: 'No URL context target was captured for this run.',
		emptyOutputText: 'No URL context payload was returned.',
		detailSections: ['summary', 'url', 'preview', 'output', 'raw'],
	},
	google_maps: {
		toolName: 'google_maps',
		label: 'Google Maps',
		shortLabel: 'Maps',
		family: 'maps',
		icon: 'google-maps',
		accent: 'amber',
		description: 'Looks up places, locations, and map-oriented details.',
		availabilityDescription: 'Uses the provider hosted maps integration for geographic answers.',
		emptyInputText: 'No place or map query was captured for this run.',
		emptyOutputText: 'No place or maps data was returned.',
		detailSections: ['summary', 'location', 'sources', 'output', 'raw'],
	},
};

const DEFAULT_TOOL_PRESENTATION: ToolInvocationPresentation = {
	toolName: 'tool',
	label: 'Tool',
	shortLabel: 'Tool',
	family: 'other',
	icon: 'tool',
	accent: 'slate',
	description: 'Executes a hosted tool call on behalf of the assistant.',
	availabilityDescription: 'Tool availability is determined by the current model and agent settings.',
	emptyInputText: 'No tool input was captured for this run.',
	emptyOutputText: 'No tool output was returned.',
	detailSections: ['summary', 'input', 'output', 'raw'],
};

export function getToolInvocationPresentation(toolName: string): ToolInvocationPresentation {
	return TOOL_INVOCATION_PRESENTATIONS[toolName] ?? {
		...DEFAULT_TOOL_PRESENTATION,
		toolName,
		label: toolName,
		shortLabel: toolName,
	};
}

export function summarizeToolInvocation(invocation: ToolInvocationInfo): string | undefined {
	switch (invocation.toolName) {
		case 'web_search':
		case 'google_search':
			return summarizeWebSearch(invocation);
		case 'web_fetch':
		case 'url_context':
			return summarizeWebFetch(invocation);
		case 'image_generation':
			return summarizeImageGeneration(invocation);
		case 'code_execution':
		case 'code_interpreter':
			return summarizeCode(invocation);
		case 'file_search':
			return summarizeFileSearch(invocation);
		case 'google_maps':
			return summarizeMaps(invocation);
		default:
			return extractQuery(invocation);
	}
}

export function resolveToolAvailability(
	agent: ChatAgentProfile | undefined,
	toolName: string,
): ToolInvocationAvailabilityInfo {
	const presentation = getToolInvocationPresentation(toolName);
	const nativeTools = agent?.modelCard.nativeTools ?? [];
	const supported = nativeTools.includes(toolName);
	const enabledTools = resolveEnabledHostedTools(agent);
	const enabled = supported && enabledTools.has(toolName);

	return {
		toolName,
		label: presentation.label,
		family: presentation.family,
		supported,
		enabled,
	};
}

/**
 * Browser-safe mirror of `resolveHostedToolState` in `domain/application/chat`.
 * Both implementations must produce identical enable/disable decisions for the
 * same agent, otherwise UI affordances will disagree with what the server
 * actually sends to the model.
 */
function resolveEnabledHostedTools(
	agent: ChatAgentProfile | undefined,
): ReadonlySet<string> {
	if (!agent) {
		return new Set();
	}

	if (agent.toolsEnabled === false) {
		return new Set();
	}

	const card = agent.modelCard;
	const toolsCapable = card.capabilities?.tools !== false;
	const isHosted = card.nativeToolSupportLevel === 'hosted';
	if (!toolsCapable || !isHosted) {
		return new Set();
	}

	const nativeTools = card.nativeTools ?? [];
	const allowedTools = new Set(nativeTools);
	const toolPolicy = card.toolPolicy;
	const enabledTools = new Set<string>(toolPolicy?.defaultEnabledTools ?? []);
	const removableTools = new Set(toolPolicy?.removableTools ?? []);

	for (const toolName of toolPolicy?.modelSpecificToolAdditions ?? []) {
		if (allowedTools.has(toolName)) {
			enabledTools.add(toolName);
		}
	}

	for (const [toolName, isEnabled] of Object.entries(agent.toolState ?? {})) {
		if (!allowedTools.has(toolName)) {
			continue;
		}

		if (isEnabled) {
			enabledTools.add(toolName);
			continue;
		}

		if (removableTools.has(toolName)) {
			enabledTools.delete(toolName);
		}
	}

	const resolved = new Set<string>();
	for (const toolName of enabledTools) {
		if (allowedTools.has(toolName)) {
			resolved.add(toolName);
		}
	}
	return resolved;
}

export function resolveHostedTools(
	agent: ChatAgentProfile | undefined,
): readonly HostedToolInfo[] {
	if (!agent) return [];

	const nativeTools = agent.modelCard.nativeTools ?? [];
	const hidden = agent.modelCard.uiPresentation.hiddenToolToggles;

	return nativeTools
		.filter((name) => !hidden.includes(name))
		.map((name) => {
			const availability = resolveToolAvailability(agent, name);
			return {
				name,
				label: availability.label,
				family: availability.family,
				enabled: availability.enabled,
			};
		});
}
