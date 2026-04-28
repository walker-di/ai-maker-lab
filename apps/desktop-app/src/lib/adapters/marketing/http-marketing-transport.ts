import type {
	MarketingCatalogTransport,
	MarketingAiTransport,
	MarketingAssetTransport,
	MarketingExportTransport,
	MarketingStrategyTransport,
} from './MarketingTransport.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleResponse(r: Response): Promise<any> {
	if (r.ok) return r.json();
	const payload = await r.json().catch(() => ({})) as { error?: string };
	throw new Error(payload.error ?? `Request failed with status ${r.status}`);
}

function json(data: unknown) {
	return { method: 'POST' as const, headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) };
}

const BASE = '/api/marketing';

export class HttpMarketingCatalogTransport implements MarketingCatalogTransport {
	// products
	async listProducts() { return handleResponse(await fetch(`${BASE}/products`)); }
	async getProduct(id: string) { return handleResponse(await fetch(`${BASE}/products/${id}`)); }
	async createProduct(data: object) { return handleResponse(await fetch(`${BASE}/products`, json(data))); }
	async updateProduct(id: string, data: object) {
		return handleResponse(await fetch(`${BASE}/products/${id}`, { ...json(data), method: 'PUT' }));
	}
	async deleteProduct(id: string) { await handleResponse(await fetch(`${BASE}/products/${id}`, { method: 'DELETE' })); }
	async generateProduct(name: string) { return handleResponse(await fetch(`${BASE}/products/generate`, json({ name }))); }

	// personas
	async listPersonas(productId?: string) {
		const url = productId ? `${BASE}/personas?productId=${encodeURIComponent(productId)}` : `${BASE}/personas`;
		return handleResponse(await fetch(url));
	}
	async getPersona(id: string) { return handleResponse(await fetch(`${BASE}/personas/${id}`)); }
	async createPersona(data: object) { return handleResponse(await fetch(`${BASE}/personas`, json(data))); }
	async updatePersona(id: string, data: object) {
		return handleResponse(await fetch(`${BASE}/personas/${id}`, { ...json(data), method: 'PUT' }));
	}
	async deletePersona(id: string) { await handleResponse(await fetch(`${BASE}/personas/${id}`, { method: 'DELETE' })); }
	async generatePersonas(productId: string, count?: number) {
		return handleResponse(await fetch(`${BASE}/products/${productId}/personas/generate`, json({ count })));
	}

	// campaigns
	async listCampaigns() { return handleResponse(await fetch(`${BASE}/campaigns`)); }
	async getCampaign(id: string) { return handleResponse(await fetch(`${BASE}/campaigns/${id}`)); }
	async createCampaign(data: object) { return handleResponse(await fetch(`${BASE}/campaigns`, json(data))); }
	async updateCampaign(id: string, data: object) {
		return handleResponse(await fetch(`${BASE}/campaigns/${id}`, { ...json(data), method: 'PUT' }));
	}
	async deleteCampaign(id: string) { await handleResponse(await fetch(`${BASE}/campaigns/${id}`, { method: 'DELETE' })); }

	// creatives
	async listCreatives(productId?: string) {
		const url = productId ? `${BASE}/creatives?productId=${encodeURIComponent(productId)}` : `${BASE}/creatives`;
		return handleResponse(await fetch(url));
	}
	async getCreative(id: string) { return handleResponse(await fetch(`${BASE}/creatives/${id}`)); }
	async createCreative(data: object) { return handleResponse(await fetch(`${BASE}/creatives`, json(data))); }
	async updateCreative(id: string, data: object) {
		return handleResponse(await fetch(`${BASE}/creatives/${id}`, { ...json(data), method: 'PUT' }));
	}
	async deleteCreative(id: string) { await handleResponse(await fetch(`${BASE}/creatives/${id}`, { method: 'DELETE' })); }

	// stories
	async listStories(creativeId?: string) {
		const url = creativeId ? `${BASE}/stories?creativeId=${encodeURIComponent(creativeId)}` : `${BASE}/stories`;
		return handleResponse(await fetch(url));
	}
	async getStory(id: string) { return handleResponse(await fetch(`${BASE}/stories/${id}`)); }
	async createStory(data: object) { return handleResponse(await fetch(`${BASE}/stories`, json(data))); }
	async updateStory(id: string, data: object) {
		return handleResponse(await fetch(`${BASE}/stories/${id}`, { ...json(data), method: 'PUT' }));
	}
	async deleteStory(id: string) { await handleResponse(await fetch(`${BASE}/stories/${id}`, { method: 'DELETE' })); }
	async updateAudioSettings(storyId: string, settings: object) {
		return handleResponse(await fetch(`${BASE}/stories/${storyId}/audio-settings`, { ...json(settings), method: 'PUT' }));
	}

	// scenes
	async listScenes(storyId?: string) {
		const url = storyId ? `${BASE}/scenes?storyId=${encodeURIComponent(storyId)}` : `${BASE}/scenes`;
		return handleResponse(await fetch(url));
	}
	async getScene(id: string) { return handleResponse(await fetch(`${BASE}/scenes/${id}`)); }
	async createScene(data: object) { return handleResponse(await fetch(`${BASE}/scenes`, json(data))); }
	async updateScene(id: string, data: object) {
		return handleResponse(await fetch(`${BASE}/scenes/${id}`, { ...json(data), method: 'PUT' }));
	}
	async deleteScene(id: string) { await handleResponse(await fetch(`${BASE}/scenes/${id}`, { method: 'DELETE' })); }

	// clips
	async listClips(sceneId?: string) {
		const url = sceneId ? `${BASE}/clips?sceneId=${encodeURIComponent(sceneId)}` : `${BASE}/clips`;
		return handleResponse(await fetch(url));
	}
	async getClip(id: string) { return handleResponse(await fetch(`${BASE}/clips/${id}`)); }
	async createClip(data: object) { return handleResponse(await fetch(`${BASE}/clips`, json(data))); }
	async updateClip(id: string, data: object) {
		return handleResponse(await fetch(`${BASE}/clips/${id}`, { ...json(data), method: 'PUT' }));
	}
	async deleteClip(id: string) { await handleResponse(await fetch(`${BASE}/clips/${id}`, { method: 'DELETE' })); }

	// bgm
	async listBgm() { return handleResponse(await fetch(`${BASE}/bgm`)); }
	async getBgm(id: string) { return handleResponse(await fetch(`${BASE}/bgm/${id}`)); }
	async createBgm(data: object) { return handleResponse(await fetch(`${BASE}/bgm`, json(data))); }
	async updateBgm(id: string, data: object) {
		return handleResponse(await fetch(`${BASE}/bgm/${id}`, { ...json(data), method: 'PUT' }));
	}
	async deleteBgm(id: string) { await handleResponse(await fetch(`${BASE}/bgm/${id}`, { method: 'DELETE' })); }

	// canvas templates
	async listCanvasTemplates() { return handleResponse(await fetch(`${BASE}/canvas-templates`)); }
	async getCanvasTemplate(id: string) { return handleResponse(await fetch(`${BASE}/canvas-templates/${id}`)); }
	async createCanvasTemplate(data: object) { return handleResponse(await fetch(`${BASE}/canvas-templates`, json(data))); }
	async updateCanvasTemplate(id: string, data: object) {
		return handleResponse(await fetch(`${BASE}/canvas-templates/${id}`, { ...json(data), method: 'PUT' }));
	}
	async deleteCanvasTemplate(id: string) { await handleResponse(await fetch(`${BASE}/canvas-templates/${id}`, { method: 'DELETE' })); }
	async duplicateCanvasTemplate(id: string, name?: string) {
		return handleResponse(await fetch(`${BASE}/canvas-templates/${id}/duplicate`, json({ name })));
	}

	// transitions
	async listTransitions() { return handleResponse(await fetch(`${BASE}/transitions`)); }
	async getTransition(id: string) { return handleResponse(await fetch(`${BASE}/transitions/${id}`)); }
	async createTransition(data: object) { return handleResponse(await fetch(`${BASE}/transitions`, json(data))); }
	async updateTransition(id: string, data: object) {
		return handleResponse(await fetch(`${BASE}/transitions/${id}`, { ...json(data), method: 'PUT' }));
	}
	async deleteTransition(id: string) { await handleResponse(await fetch(`${BASE}/transitions/${id}`, { method: 'DELETE' })); }
}

export class HttpMarketingAiTransport implements MarketingAiTransport {
	async generatePersonas(productId: string, count?: number) {
		return handleResponse(await fetch(`${BASE}/products/${productId}/personas/generate`, json({ count })));
	}
	async generateCreativeText(creativeId: string, productId: string, personaId: string, type: string) {
		return handleResponse(await fetch(`${BASE}/creatives/${creativeId}/generate-text`, json({ productId, personaId, type })));
	}
	async generateImage(creativeId: string, prompt: string, style?: string) {
		return handleResponse(await fetch(`${BASE}/creatives/${creativeId}/generate-image`, json({ prompt, style })));
	}
	async generateBgm(prompt: string, duration?: number, name?: string) {
		return handleResponse(await fetch(`${BASE}/bgm/generate`, json({ prompt, duration, name })));
	}
	async aiFillClip(clipId: string) {
		return handleResponse(await fetch(`${BASE}/clips/${clipId}/ai-fill`, { method: 'POST' }));
	}
	async generateStrategy(productId: string, campaignId?: string) {
		return handleResponse(await fetch(`${BASE}/strategies/generate`, json({ productId, campaignId })));
	}
	async suggestBgm(sceneId: string) {
		return handleResponse(await fetch(`${BASE}/scenes/${sceneId}/suggest-bgm`, { method: 'POST' }));
	}
	async autoSelectBgm(sceneId: string) {
		return handleResponse(await fetch(`${BASE}/scenes/${sceneId}/auto-select-bgm`, { method: 'POST' }));
	}
}

export class HttpMarketingAssetTransport implements MarketingAssetTransport {
	async uploadImage(file: File) {
		const form = new FormData();
		form.append('file', file);
		return handleResponse(await fetch(`${BASE}/upload/image`, { method: 'POST', body: form }));
	}
	async uploadAudio(file: File) {
		const form = new FormData();
		form.append('file', file);
		return handleResponse(await fetch(`${BASE}/upload/audio`, { method: 'POST', body: form }));
	}
	async listImages() { return handleResponse(await fetch(`${BASE}/upload/list-images`)); }
	async listAudio() { return handleResponse(await fetch(`${BASE}/upload/list-audio`)); }
}

export class HttpMarketingExportTransport implements MarketingExportTransport {
	async exportStory(storyId: string) {
		return handleResponse(await fetch(`${BASE}/stories/${storyId}/export-video`, { method: 'POST' }));
	}
	async exportClip(clipId: string) {
		return handleResponse(await fetch(`${BASE}/clips/${clipId}/export-video`, { method: 'POST' }));
	}
}

export class HttpMarketingStrategyTransport implements MarketingStrategyTransport {
	async listStrategies(productId?: string) {
		const url = productId ? `${BASE}/strategies?productId=${encodeURIComponent(productId)}` : `${BASE}/strategies`;
		return handleResponse(await fetch(url));
	}
	async getStrategy(id: string) { return handleResponse(await fetch(`${BASE}/strategies/${id}`)); }
	async createStrategy(data: object) { return handleResponse(await fetch(`${BASE}/strategies`, json(data))); }
	async updateStrategy(id: string, data: object) {
		return handleResponse(await fetch(`${BASE}/strategies/${id}`, { ...json(data), method: 'PUT' }));
	}
	async deleteStrategy(id: string) { await handleResponse(await fetch(`${BASE}/strategies/${id}`, { method: 'DELETE' })); }
	async generateStrategy(productId: string, campaignId?: string) {
		return handleResponse(await fetch(`${BASE}/strategies/generate`, json({ productId, campaignId })));
	}
}
