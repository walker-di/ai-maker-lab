import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Voxsim } from 'domain/application';
import { getVoxsimServices, toVoxsimErrorResponse } from '$lib/server/voxsim-service';

export const prerender = false;

export const GET: RequestHandler = async () => {
	try {
		const services = await getVoxsimServices();
		const useCase = new Voxsim.UseCases.ListArenas(services.arenaCatalog);
		return json(await useCase.execute());
	} catch (error) {
		return toVoxsimErrorResponse(error);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const services = await getVoxsimServices();
		const body = (await request.json()) as Voxsim.UseCases.SaveUserArenaInput;
		const useCase = new Voxsim.UseCases.SaveUserArena(services.users);
		return json(await useCase.execute(body));
	} catch (error) {
		return toVoxsimErrorResponse(error);
	}
};
