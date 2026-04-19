import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Voxsim } from 'domain/application';
import { getVoxsimServices, toVoxsimErrorResponse } from '$lib/server/voxsim-service';

export const prerender = false;

export const POST: RequestHandler = async ({ request }) => {
	try {
		const services = await getVoxsimServices();
		const body = (await request.json()) as Voxsim.UseCases.DuplicateBuiltInArenaInput;
		const useCase = new Voxsim.UseCases.DuplicateBuiltInArena(services.builtIns, services.users);
		return json(await useCase.execute(body));
	} catch (error) {
		return toVoxsimErrorResponse(error);
	}
};
