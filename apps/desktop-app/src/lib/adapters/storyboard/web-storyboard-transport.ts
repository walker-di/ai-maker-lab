import type { Marketing } from 'domain/shared';
import type { StoryboardAssetType, StoryboardPromptType, StoryboardTransport } from './StoryboardTransport';

async function readResponse<T>(response: Response): Promise<T> {
	if (!response.ok) {
		const body = await response.json().catch(() => ({}));
		throw new Error(typeof body.error === 'string' ? body.error : `Request failed (${response.status})`);
	}
	return await response.json() as T;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
	return readResponse<T>(await fetch(url, {
		...init,
		headers: {
			'content-type': 'application/json',
			...(init?.headers ?? {}),
		},
	}));
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

	async generateFrameAsset(storyboardId: string, frameId: string, assetType: StoryboardAssetType) {
		return requestJson<Marketing.StoryboardFrame>(`${this.frameUrl(storyboardId, frameId)}/generate-asset`, {
			method: 'POST',
			body: JSON.stringify({ assetType }),
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

	private storyboardUrl(storyboardId: string) {
		return `/api/marketing/storyboards/${encodeURIComponent(storyboardId)}`;
	}

	private frameUrl(storyboardId: string, frameId: string) {
		return `${this.storyboardUrl(storyboardId)}/frames/${encodeURIComponent(frameId)}`;
	}
}
