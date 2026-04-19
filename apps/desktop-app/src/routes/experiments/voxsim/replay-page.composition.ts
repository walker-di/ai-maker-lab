import { createVoxsimTransport } from '$lib/adapters/voxsim/create-voxsim-transport';
import { createVoxsimReplayPageModel } from './replay-page.svelte';

export function createVoxsimReplayPage(runId: string) {
	const model = createVoxsimReplayPageModel({
		transport: createVoxsimTransport(),
		runId
	});
	void model.bootstrap();
	return model;
}
