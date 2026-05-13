import { createMarketingTransport } from '$lib/adapters/marketing/create-marketing-transport.js';
import { createSceneEditorPageModel } from './scene-editor-page.svelte.js';

export function createSceneEditorPage(storyId: string) {
	const model = createSceneEditorPageModel({ transport: createMarketingTransport() });
	void model.loadScenes(storyId);
	return model;
}
