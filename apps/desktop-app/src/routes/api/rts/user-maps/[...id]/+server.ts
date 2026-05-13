import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRtsServices, toRtsErrorResponse } from '$lib/server/rts-service';
import { Rts } from 'domain/application';

export const prerender = false;

export const GET: RequestHandler = async ({ params }) => {
	try {
		const { userMaps } = await getRtsServices();
		const useCase = Rts.createLoadUserMap(userMaps);
		const map = await useCase.execute(params.id ?? '');
		if (!map) return json({ error: 'not found' }, { status: 404 });
		return json(map);
	} catch (error) {
		return toRtsErrorResponse(error);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const { userMaps } = await getRtsServices();
		const useCase = Rts.createDeleteUserMap(userMaps);
		await useCase.execute(params.id ?? '');
		return json({ ok: true });
	} catch (error) {
		return toRtsErrorResponse(error);
	}
};
