import { createVoxsimTransport } from '$lib/adapters/voxsim/create-voxsim-transport';
import { createVoxsimEditorPageModel } from './editor-page.svelte';

export function createVoxsimEditorPage() {
	const model = createVoxsimEditorPageModel({
		transport: createVoxsimTransport()
	});
	void model.bootstrap();
	return model;
}
