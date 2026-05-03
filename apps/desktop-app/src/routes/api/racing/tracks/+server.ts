import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRacingServices, toRacingErrorResponse } from '$lib/server/racing-service';

export const prerender = false;

export const GET: RequestHandler = async () => {
	try {
		const { catalog } = await getRacingServices();
		return json(await catalog.listTracks());
	} catch (error) {
		return toRacingErrorResponse(error);
	}
};
