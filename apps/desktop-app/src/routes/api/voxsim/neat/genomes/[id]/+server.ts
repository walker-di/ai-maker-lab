import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Voxsim } from 'domain/application';
import { getVoxsimServices, toVoxsimErrorResponse } from '$lib/server/voxsim-service';

export const prerender = false;

export const GET: RequestHandler = async ({ params }) => {
	try {
		const services = await getVoxsimServices();
		const useCase = new Voxsim.UseCases.LoadNeatGenome(services.neatGenomes);
		const record = await useCase.execute(params.id ?? '');
		if (!record) return json({ error: 'NEAT genome not found' }, { status: 404 });
		return json(record);
	} catch (error) {
		return toVoxsimErrorResponse(error);
	}
};
