import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRtsServices, toRtsErrorResponse } from '$lib/server/rts-service';
import { Rts } from 'domain/application';

export const prerender = false;

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { catalog } = await getRtsServices();
		const useCase = Rts.createStartMatch(catalog);
		const body = (await request.json()) as Rts.StartMatchInput;
		return json(await useCase.execute(body));
	} catch (error) {
		return toRtsErrorResponse(error);
	}
};
