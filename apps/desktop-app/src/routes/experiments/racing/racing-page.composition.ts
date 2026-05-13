import { createRacingTransport } from '$lib/adapters/racing/create-racing-transport';
import { createRacingPageModel, type RacingPageDeps } from './racing-page.svelte.ts';

export interface RacingPageOverrides {
	transport?: RacingPageDeps['transport'];
	initialTrackId?: string;
	initialVehicleId?: string;
	initialCamera?: RacingPageDeps['initialCamera'];
}

export function createRacingPage(overrides: RacingPageOverrides = {}) {
	const model = createRacingPageModel({
		transport: overrides.transport ?? createRacingTransport(),
		initialTrackId: overrides.initialTrackId,
		initialVehicleId: overrides.initialVehicleId,
		initialCamera: overrides.initialCamera,
	});
	void model.bootstrap();
	return model;
}
