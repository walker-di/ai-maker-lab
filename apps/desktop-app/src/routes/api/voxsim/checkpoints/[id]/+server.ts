import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Voxsim } from 'domain/application';
import { getVoxsimServices, toVoxsimErrorResponse } from '$lib/server/voxsim-service';
import { jsonWithBytes } from '$lib/server/voxsim-codec';

export const prerender = false;

export const GET: RequestHandler = async ({ params }) => {
	try {
		const services = await getVoxsimServices();
		const useCase = new Voxsim.UseCases.LoadWeightCheckpoint(services.checkpoints);
		const cp = await useCase.execute(params.id ?? '');
		if (!cp) return json({ error: 'Checkpoint not found' }, { status: 404 });
		return jsonWithBytes(cp);
	} catch (error) {
		return toVoxsimErrorResponse(error);
	}
};
