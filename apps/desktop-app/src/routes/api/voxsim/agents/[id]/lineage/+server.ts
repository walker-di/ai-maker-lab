import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Voxsim } from 'domain/application';
import { getVoxsimServices, toVoxsimErrorResponse } from '$lib/server/voxsim-service';

export const prerender = false;

export const GET: RequestHandler = async ({ params }) => {
	try {
		const services = await getVoxsimServices();
		const useCase = new Voxsim.UseCases.ListLineage(services.agents);
		return json(await useCase.execute(params.id ?? ''));
	} catch (error) {
		return toVoxsimErrorResponse(error);
	}
};
