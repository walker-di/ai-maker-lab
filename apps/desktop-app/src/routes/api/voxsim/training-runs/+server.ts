import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Voxsim } from 'domain/application';
import type { Voxsim as VoxsimShared } from 'domain/shared';
import { getVoxsimServices, toVoxsimErrorResponse } from '$lib/server/voxsim-service';

export const prerender = false;

export const GET: RequestHandler = async ({ url }) => {
	try {
		const services = await getVoxsimServices();
		const filter: VoxsimShared.ListRunsFilter = {
			agentId: url.searchParams.get('agentId') ?? undefined,
			status:
				(url.searchParams.get('status') as VoxsimShared.TrainingRunStatus | null) ?? undefined,
			since: url.searchParams.get('since') ?? undefined,
			limit: url.searchParams.get('limit')
				? Number(url.searchParams.get('limit'))
				: undefined
		};
		const useCase = new Voxsim.UseCases.ListTrainingRuns(services.runs);
		return json(await useCase.execute(filter));
	} catch (error) {
		return toVoxsimErrorResponse(error);
	}
};

/**
 * Note: a full StartTrainingRun handler requires a wired `TrainingCoordinator`
 * which depends on a `TrainerOrchestrator`. v1 stops at returning 501 so the
 * UI can wire the rest of the run lifecycle when the trainer host is ready.
 */
export const POST: RequestHandler = async () => {
	return json(
		{ error: 'Training run start is not wired in this build (orchestrator host pending)' },
		{ status: 501 }
	);
};
