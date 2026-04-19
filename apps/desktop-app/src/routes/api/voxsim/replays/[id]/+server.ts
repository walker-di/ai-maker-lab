import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Voxsim } from 'domain/application';
import { getVoxsimServices, toVoxsimErrorResponse } from '$lib/server/voxsim-service';
import { jsonWithBytes } from '$lib/server/voxsim-codec';

export const prerender = false;

export const GET: RequestHandler = async ({ params }) => {
	try {
		const services = await getVoxsimServices();
		const useCase = new Voxsim.UseCases.LoadReplay(services.replays);
		const replay = await useCase.execute(params.id ?? '');
		if (!replay) return json({ error: 'Replay not found' }, { status: 404 });
		return jsonWithBytes(replay);
	} catch (error) {
		return toVoxsimErrorResponse(error);
	}
};
