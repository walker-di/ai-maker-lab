import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Voxsim } from 'domain/application';
import type { Voxsim as VoxsimShared } from 'domain/shared';
import { getVoxsimServices, toVoxsimErrorResponse } from '$lib/server/voxsim-service';

export const prerender = false;

export const GET: RequestHandler = async ({ url }) => {
	try {
		const services = await getVoxsimServices();
		const filter: VoxsimShared.ListAgentsFilter = {
			kind: (url.searchParams.get('kind') as VoxsimShared.OrganismKind | null) ?? undefined,
			bodyDnaId: url.searchParams.get('bodyDnaId') ?? undefined,
			lineageRootId: url.searchParams.get('lineageRootId') ?? undefined,
			since: url.searchParams.get('since') ?? undefined,
			limit: url.searchParams.get('limit')
				? Number(url.searchParams.get('limit'))
				: undefined
		};
		const useCase = new Voxsim.UseCases.ListAgents(services.agentCatalog);
		return json(await useCase.execute(filter));
	} catch (error) {
		return toVoxsimErrorResponse(error);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const services = await getVoxsimServices();
		const body = (await request.json()) as Voxsim.UseCases.CreateAgentRequest;
		const useCase = new Voxsim.UseCases.CreateAgent(services.agents);
		return json(await useCase.execute(body));
	} catch (error) {
		return toVoxsimErrorResponse(error);
	}
};
