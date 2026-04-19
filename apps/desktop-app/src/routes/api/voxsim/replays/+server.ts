import type { RequestHandler } from './$types';
import { Voxsim } from 'domain/application';
import { getVoxsimServices, toVoxsimErrorResponse } from '$lib/server/voxsim-service';
import { jsonWithBytes, readVoxsimJson } from '$lib/server/voxsim-codec';

export const prerender = false;

export const POST: RequestHandler = async ({ request }) => {
	try {
		const services = await getVoxsimServices();
		const body = await readVoxsimJson<Voxsim.RecordReplayInput>(request);
		const useCase = new Voxsim.UseCases.RecordReplay(services.replays);
		return jsonWithBytes(await useCase.execute(body));
	} catch (error) {
		return toVoxsimErrorResponse(error);
	}
};
