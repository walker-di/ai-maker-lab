import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Voxsim } from 'domain/application';
import type { Voxsim as VoxsimShared } from 'domain/shared';
import { getVoxsimServices, toVoxsimErrorResponse } from '$lib/server/voxsim-service';

export const prerender = false;

export const GET: RequestHandler = async ({ url }) => {
	try {
		const services = await getVoxsimServices();
		const runId = url.searchParams.get('runId');
		if (!runId) return json({ error: 'runId is required' }, { status: 400 });
		const filter: VoxsimShared.ListNeatInnovationsFilter = {
			runId,
			sinceGeneration: url.searchParams.get('sinceGeneration')
				? Number(url.searchParams.get('sinceGeneration'))
				: undefined,
			limit: url.searchParams.get('limit')
				? Number(url.searchParams.get('limit'))
				: undefined
		};
		const useCase = new Voxsim.UseCases.ListNeatInnovationLog(services.neatInnovations);
		return json(await useCase.execute(filter));
	} catch (error) {
		return toVoxsimErrorResponse(error);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const services = await getVoxsimServices();
		const body = (await request.json()) as Voxsim.RecordNeatInnovationLogInput;
		const useCase = new Voxsim.UseCases.RecordNeatInnovationLog(services.neatInnovations);
		return json(await useCase.execute(body));
	} catch (error) {
		return toVoxsimErrorResponse(error);
	}
};
