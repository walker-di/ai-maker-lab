import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRtsServices, toRtsErrorResponse } from '$lib/server/rts-service';
import { Rts } from 'domain/application';

export const prerender = false;

export const GET: RequestHandler = async () => {
	try {
		const { userMaps } = await getRtsServices();
		const useCase = Rts.createListUserMaps(userMaps);
		return json(await useCase.execute());
	} catch (error) {
		return toRtsErrorResponse(error);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { userMaps } = await getRtsServices();
		const useCase = Rts.createSaveUserMap(userMaps);
		const body = (await request.json()) as Rts.SaveUserMapUseCaseInput;
		return json(await useCase.execute(body));
	} catch (error) {
		return toRtsErrorResponse(error);
	}
};
