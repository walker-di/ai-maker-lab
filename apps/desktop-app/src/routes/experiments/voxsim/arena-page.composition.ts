import { createVoxsimTransport } from '$lib/adapters/voxsim/create-voxsim-transport';
import { createVoxsimArenaPageModel } from './arena-page.svelte';

export function createVoxsimArenaPage() {
	const model = createVoxsimArenaPageModel({
		transport: createVoxsimTransport()
	});
	void model.bootstrap();
	return model;
}
