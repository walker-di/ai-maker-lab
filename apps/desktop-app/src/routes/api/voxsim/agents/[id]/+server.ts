import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Voxsim } from 'domain/application';
import { getVoxsimServices, toVoxsimErrorResponse } from '$lib/server/voxsim-service';

export const prerender = false;

export const GET: RequestHandler = async ({ params }) => {
	try {
		const services = await getVoxsimServices();
		const useCase = new Voxsim.UseCases.LoadAgent(services.agentCatalog);
		const loaded = await useCase.execute(params.id ?? '');
		if (!loaded) return json({ error: 'Agent not found' }, { status: 404 });
		return json(loaded);
	} catch (error) {
		return toVoxsimErrorResponse(error);
	}
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	try {
		const services = await getVoxsimServices();
		const body = (await request.json()) as Voxsim.UseCases.UpdateAgentDnaRequest;
		const useCase = new Voxsim.UseCases.UpdateAgentDna(services.agents);
		await useCase.execute({ ...body, id: params.id ?? '' });
		const loaded = await new Voxsim.UseCases.LoadAgent(services.agentCatalog).execute(
			params.id ?? ''
		);
		if (!loaded) return json({ error: 'Agent not found' }, { status: 404 });
		return json(loaded.summary);
	} catch (error) {
		return toVoxsimErrorResponse(error);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const services = await getVoxsimServices();
		const useCase = new Voxsim.UseCases.DeleteAgent(services.agents);
		await useCase.execute(params.id ?? '');
		return new Response(null, { status: 204 });
	} catch (error) {
		return toVoxsimErrorResponse(error);
	}
};
