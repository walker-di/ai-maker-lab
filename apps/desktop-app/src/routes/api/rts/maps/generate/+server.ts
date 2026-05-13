import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRtsServices, toRtsErrorResponse } from '$lib/server/rts-service';
import type { Rts } from 'domain/shared';

export const prerender = false;

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as Rts.Generation.MapGenerationParams;
		const { generator } = await getRtsServices();
		return json(generator.generate(body));
	} catch (error) {
		return toRtsErrorResponse(error);
	}
};
