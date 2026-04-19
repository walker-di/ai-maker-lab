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
		const filter: VoxsimShared.ListNeatSpeciesFilter = {
			runId,
			generation: url.searchParams.get('generation')
				? Number(url.searchParams.get('generation'))
				: undefined,
			limit: url.searchParams.get('limit')
				? Number(url.searchParams.get('limit'))
				: undefined
		};
		const useCase = new Voxsim.UseCases.ListNeatSpecies(services.neatSpecies);
		return json(await useCase.execute(filter));
	} catch (error) {
		return toVoxsimErrorResponse(error);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const services = await getVoxsimServices();
		const body = (await request.json()) as Voxsim.RecordNeatSpeciesSnapshotInput;
		const useCase = new Voxsim.UseCases.RecordNeatSpeciesSnapshot(services.neatSpecies);
		return json(await useCase.execute(body));
	} catch (error) {
		return toVoxsimErrorResponse(error);
	}
};
