import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Voxsim } from 'domain/application';
import type { Voxsim as VoxsimShared } from 'domain/shared';
import { getVoxsimServices, toVoxsimErrorResponse } from '$lib/server/voxsim-service';

export const prerender = false;

export const GET: RequestHandler = async ({ url }) => {
	try {
		const services = await getVoxsimServices();
		const filter: VoxsimShared.ListNeatGenomesFilter = {
			agentId: url.searchParams.get('agentId') ?? undefined,
			runId: url.searchParams.get('runId') ?? undefined,
			speciesId: url.searchParams.get('speciesId')
				? Number(url.searchParams.get('speciesId'))
				: undefined,
			generation: url.searchParams.get('generation')
				? Number(url.searchParams.get('generation'))
				: undefined,
			minScore: url.searchParams.get('minScore')
				? Number(url.searchParams.get('minScore'))
				: undefined,
			limit: url.searchParams.get('limit')
				? Number(url.searchParams.get('limit'))
				: undefined
		};
		const useCase = new Voxsim.UseCases.ListNeatGenomes(services.neatGenomes);
		return json(await useCase.execute(filter));
	} catch (error) {
		return toVoxsimErrorResponse(error);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const services = await getVoxsimServices();
		const body = (await request.json()) as Voxsim.RecordNeatGenomeInput;
		const useCase = new Voxsim.UseCases.RecordNeatGenome(services.neatGenomes);
		return json(await useCase.execute(body));
	} catch (error) {
		return toVoxsimErrorResponse(error);
	}
};
