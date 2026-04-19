import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRtsServices, toRtsErrorResponse } from '$lib/server/rts-service';

export const prerender = false;

export const GET: RequestHandler = async ({ params }) => {
	try {
		const { catalog } = await getRtsServices();
		const map = await catalog.loadResolved(params.id ?? '');
		if (!map) return json({ error: 'not found' }, { status: 404 });
		return json(map);
	} catch (error) {
		return toRtsErrorResponse(error);
	}
};
