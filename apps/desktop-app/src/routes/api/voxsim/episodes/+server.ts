import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Voxsim } from 'domain/application';
import type { Voxsim as VoxsimShared } from 'domain/shared';
import { getVoxsimServices, toVoxsimErrorResponse } from '$lib/server/voxsim-service';

export const prerender = false;

export const GET: RequestHandler = async ({ url }) => {
	try {
		const services = await getVoxsimServices();
		const filter: VoxsimShared.ListEpisodesFilter = {
			runId: url.searchParams.get('runId') ?? undefined,
			agentId: url.searchParams.get('agentId') ?? undefined,
			arenaId: url.searchParams.get('arenaId') ?? undefined,
			outcome:
				(url.searchParams.get('outcome') as VoxsimShared.EpisodeOutcome['kind'] | null) ??
				undefined,
			since: url.searchParams.get('since') ?? undefined,
			limit: url.searchParams.get('limit')
				? Number(url.searchParams.get('limit'))
				: undefined
		};
		const useCase = new Voxsim.UseCases.ListEpisodes(services.episodes);
		return json(await useCase.execute(filter));
	} catch (error) {
		return toVoxsimErrorResponse(error);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const services = await getVoxsimServices();
		const body = (await request.json()) as VoxsimShared.EpisodeSummary;
		const useCase = new Voxsim.UseCases.RecordEpisode(services.episodes);
		return json(await useCase.execute(body));
	} catch (error) {
		return toVoxsimErrorResponse(error);
	}
};
