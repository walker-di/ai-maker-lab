import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Voxsim } from 'domain/application';
import { getVoxsimServices, toVoxsimErrorResponse } from '$lib/server/voxsim-service';

export const prerender = false;

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const services = await getVoxsimServices();
		const body = (await request.json()) as { mutation: Voxsim.AgentMutationSpec; name?: string };
		const useCase = new Voxsim.UseCases.MutateAgent(services.agentCatalog);
		return json(await useCase.execute({ id: params.id ?? '', mutation: body.mutation, name: body.name }));
	} catch (error) {
		return toVoxsimErrorResponse(error);
	}
};
