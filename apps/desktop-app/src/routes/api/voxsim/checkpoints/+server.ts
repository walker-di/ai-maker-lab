import type { RequestHandler } from './$types';
import { Voxsim } from 'domain/application';
import type { Voxsim as VoxsimShared } from 'domain/shared';
import { getVoxsimServices, toVoxsimErrorResponse } from '$lib/server/voxsim-service';
import { jsonWithBytes, readVoxsimJson } from '$lib/server/voxsim-codec';

export const prerender = false;

export const GET: RequestHandler = async ({ url }) => {
	try {
		const services = await getVoxsimServices();
		const filter: VoxsimShared.ListCheckpointsFilter = {
			agentId: url.searchParams.get('agentId') ?? undefined,
			runId: url.searchParams.get('runId') ?? undefined,
			minScore: url.searchParams.get('minScore')
				? Number(url.searchParams.get('minScore'))
				: undefined,
			limit: url.searchParams.get('limit')
				? Number(url.searchParams.get('limit'))
				: undefined
		};
		const useCase = new Voxsim.UseCases.ListCheckpoints(services.checkpoints);
		return jsonWithBytes(await useCase.execute(filter));
	} catch (error) {
		return toVoxsimErrorResponse(error);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const services = await getVoxsimServices();
		const body = await readVoxsimJson<Voxsim.RecordWeightCheckpointInput>(request);
		const useCase = new Voxsim.UseCases.SaveWeightCheckpoint(services.checkpoints);
		return jsonWithBytes(await useCase.execute(body));
	} catch (error) {
		return toVoxsimErrorResponse(error);
	}
};
