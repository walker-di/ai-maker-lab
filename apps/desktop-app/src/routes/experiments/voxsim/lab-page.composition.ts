import { createVoxsimTransport } from '$lib/adapters/voxsim/create-voxsim-transport';
import { createVoxsimLabPageModel } from './lab-page.svelte';

export function createVoxsimLabPage() {
	const model = createVoxsimLabPageModel({
		transport: createVoxsimTransport()
	});
	void model.bootstrap();
	return model;
}
