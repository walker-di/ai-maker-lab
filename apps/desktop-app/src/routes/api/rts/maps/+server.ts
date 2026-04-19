import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRtsServices, toRtsErrorResponse } from '$lib/server/rts-service';

export const prerender = false;

export const GET: RequestHandler = async () => {
	try {
		const { catalog } = await getRtsServices();
		return json(await catalog.listResolved());
	} catch (error) {
		return toRtsErrorResponse(error);
	}
};
