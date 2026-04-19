import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Voxsim } from 'domain/application';
import { getVoxsimServices, toVoxsimErrorResponse } from '$lib/server/voxsim-service';

export const prerender = false;

export const GET: RequestHandler = async ({ params }) => {
	try {
		const services = await getVoxsimServices();
		const useCase = new Voxsim.UseCases.LoadArena(services.arenaCatalog);
		const entry = await useCase.execute(params.id ?? '');
		if (!entry) return json({ error: 'Arena not found' }, { status: 404 });
		return json(entry);
	} catch (error) {
		return toVoxsimErrorResponse(error);
	}
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	try {
		const services = await getVoxsimServices();
		const body = (await request.json()) as Voxsim.UseCases.UpdateUserArenaInput;
		const useCase = new Voxsim.UseCases.UpdateUserArena(services.users);
		return json(await useCase.execute({ ...body, id: params.id ?? '' }));
	} catch (error) {
		return toVoxsimErrorResponse(error);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const services = await getVoxsimServices();
		const useCase = new Voxsim.UseCases.DeleteUserArena(services.users);
		await useCase.execute(params.id ?? '');
		return new Response(null, { status: 204 });
	} catch (error) {
		return toVoxsimErrorResponse(error);
	}
};
