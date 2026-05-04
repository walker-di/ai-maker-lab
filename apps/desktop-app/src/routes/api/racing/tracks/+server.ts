import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRacingCatalog, toRacingErrorResponse } from '$lib/server/racing-service';

export const prerender = false;

export const GET: RequestHandler = async () => {
	try {
		return json(await getRacingCatalog().listTracks());
	} catch (error) {
		return toRacingErrorResponse(error);
	}
};
