import type { Marketing } from 'domain/shared';
import type { StoryboardAssetType, StoryboardPromptType, StoryboardTransport } from './StoryboardTransport';

export type StoryboardTransportErrorKind =
	| 'backend-unavailable'
	| 'not-found'
	| 'validation'
	| 'network'
	| 'server';

export class StoryboardTransportError extends Error {
	readonly kind: StoryboardTransportErrorKind;
	readonly status: number | undefined;
	readonly technicalMessage: string | undefined;

	constructor(options: {
		kind: StoryboardTransportErrorKind;
		userMessage: string;
		status?: number;
		technicalMessage?: string;
	}) {
		super(options.userMessage);
		this.name = 'StoryboardTransportError';
		this.kind = options.kind;
		this.status = options.status;
		this.technicalMessage = options.technicalMessage;
	}
}

function classifyError(status: number, serverMessage: string): StoryboardTransportErrorKind {
	if (status === 404) return 'not-found';
	if (status === 400) return 'validation';
	if (status === 502 || status === 503) return 'backend-unavailable';
	if (status >= 500) {
		const lower = serverMessage.toLowerCase();
		if (lower.includes('timed out') || lower.includes('connection') || lower.includes('surreal')) {
			return 'backend-unavailable';
		}
		return 'server';
	}
	return 'server';
}

async function readResponse<T>(response: Response): Promise<T> {
	if (!response.ok) {
		const body = await response.json().catch(() => ({}));
		const serverMessage = typeof body.error === 'string' ? body.error : `Request failed (${response.status})`;
		const kind = classifyError(response.status, serverMessage);
		const userMessages: Record<StoryboardTransportErrorKind, string> = {
			'backend-unavailable': 'The storyboard service is temporarily unavailable. Please try again shortly.',
			'not-found': 'The requested storyboard could not be found.',
			'validation': 'The request was invalid. Please check your input.',
			'network': 'A network error occurred. Please check your connection.',
			'server': 'An unexpected server error occurred. Please try again.',
		};
		throw new StoryboardTransportError({
			kind,
			userMessage: userMessages[kind],
			status: response.status,
			technicalMessage: serverMessage,
		});
	}
	return await response.json() as T;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
	let response: Response;
	try {
		response = await fetch(url, {
			...init,
			headers: {
				'content-type': 'application/json',
				...(init?.headers ?? {}),
			},
		});
	} catch {
		throw new StoryboardTransportError({
			kind: 'network',
			userMessage: 'A network error occurred. Please check your connection.',
			technicalMessage: `fetch ${init?.method ?? 'GET'} ${url} failed`,
		});
	}
	return readResponse<T>(response);
}

export class WebStoryboardTransport implements StoryboardTransport {
	async listStoryboards() {
		return requestJson<Marketing.StoryboardSummary[]>('/api/marketing/storyboards');
	}

	async getStoryboard(id: string) {
		return requestJson<Marketing.StoryboardDetail>(`/api/marketing/storyboards/${encodeURIComponent(id)}`);
	}

	async createStoryboard(input: Marketing.CreateStoryboardDto) {
		return requestJson<Marketing.StoryboardSummary>('/api/marketing/storyboards', {
			method: 'POST',
			body: JSON.stringify(input),
		});
	}

	async generateFrames(storyboardId: string, input: Marketing.GenerateStoryboardFramesDto) {
		return requestJson<Marketing.StoryboardDetail>(`${this.storyboardUrl(storyboardId)}/frames/generate`, {
			method: 'POST',
			body: JSON.stringify(input),
		});
	}

	async insertBlankFrame(storyboardId: string, input: Marketing.InsertBlankStoryboardFrameDto) {
		return requestJson<Marketing.StoryboardDetail>(`${this.storyboardUrl(storyboardId)}/frames/insert`, {
			method: 'POST',
			body: JSON.stringify(input),
		});
	}

	async updateFrameText(storyboardId: string, frameId: string, input: Marketing.UpdateStoryboardFrameTextDto) {
		return requestJson<Marketing.StoryboardFrame>(this.frameUrl(storyboardId, frameId), {
			method: 'PUT',
			body: JSON.stringify(input),
		});
	}

	async deleteFrame(storyboardId: string, frameId: string) {
		return requestJson<Marketing.StoryboardDetail>(this.frameUrl(storyboardId, frameId), { method: 'DELETE' });
	}

	async reorderFrame(storyboardId: string, frameId: string, input: Marketing.ReorderStoryboardFrameDto) {
		return requestJson<Marketing.StoryboardDetail>(`${this.frameUrl(storyboardId, frameId)}/reorder`, {
			method: 'POST',
			body: JSON.stringify(input),
		});
	}

	async regeneratePrompt(storyboardId: string, frameId: string, promptType: StoryboardPromptType) {
		return requestJson<{ prompt: string; frame: Marketing.StoryboardFrame }>(`${this.frameUrl(storyboardId, frameId)}/regenerate-prompt`, {
			method: 'POST',
			body: JSON.stringify({ promptType }),
		});
	}

	async generateFrameAsset(storyboardId: string, frameId: string, assetType: StoryboardAssetType, modelConfig?: Marketing.StoryboardModelConfig) {
		const body: Record<string, unknown> = { assetType };
		if (modelConfig) body.modelConfig = modelConfig;
		return requestJson<Marketing.StoryboardFrame>(`${this.frameUrl(storyboardId, frameId)}/generate-asset`, {
			method: 'POST',
			body: JSON.stringify(body),
		});
	}

	async attachFrameAsset(storyboardId: string, frameId: string, input: Marketing.AttachStoryboardFrameAssetDto) {
		return requestJson<Marketing.StoryboardFrame>(`${this.frameUrl(storyboardId, frameId)}/attach-asset`, {
			method: 'POST',
			body: JSON.stringify(input),
		});
	}

	async updateTransition(storyboardId: string, frameId: string, input: Marketing.UpdateStoryboardTransitionDto) {
		return requestJson<Marketing.StoryboardFrame>(`${this.frameUrl(storyboardId, frameId)}/transition`, {
			method: 'PUT',
			body: JSON.stringify(input),
		});
	}

	async exportUnifiedVideo(storyboardId: string) {
		return requestJson<Marketing.StoryboardExportResult>(`${this.storyboardUrl(storyboardId)}/export-video`, { method: 'POST' });
	}

	async batchGenerateAssets(storyboardId: string, input?: Marketing.BatchGenerateAssetsDto) {
		return requestJson<Marketing.StoryboardDetail>(`${this.storyboardUrl(storyboardId)}/frames/batch-generate-assets`, {
			method: 'POST',
			body: JSON.stringify(input ?? {}),
		});
	}

	async batchRegeneratePrompts(storyboardId: string, input?: Marketing.BatchRegeneratePromptsDto) {
		return requestJson<Marketing.StoryboardDetail>(`${this.storyboardUrl(storyboardId)}/frames/batch-regenerate-prompts`, {
			method: 'POST',
			body: JSON.stringify(input ?? {}),
		});
	}

	async duplicateFrame(storyboardId: string, frameId: string, input?: Marketing.DuplicateFrameDto) {
		return requestJson<Marketing.StoryboardDetail>(`${this.frameUrl(storyboardId, frameId)}/duplicate`, {
			method: 'POST',
			body: JSON.stringify(input ?? {}),
		});
	}

	async autoAssignTransitions(storyboardId: string, input: Marketing.AutoAssignTransitionsDto) {
		return requestJson<Marketing.StoryboardDetail>(`${this.storyboardUrl(storyboardId)}/transitions/auto-assign`, {
			method: 'POST',
			body: JSON.stringify(input),
		});
	}

	private storyboardUrl(storyboardId: string) {
		return `/api/marketing/storyboards/${encodeURIComponent(storyboardId)}`;
	}

	private frameUrl(storyboardId: string, frameId: string) {
		return `${this.storyboardUrl(storyboardId)}/frames/${encodeURIComponent(frameId)}`;
	}
}
