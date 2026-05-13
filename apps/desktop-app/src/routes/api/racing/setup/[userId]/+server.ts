import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRacingServices, toRacingErrorResponse } from '$lib/server/racing-service';
import type { Racing } from 'domain/shared';

export const prerender = false;

export const GET: RequestHandler = async ({ params }) => {
	try {
		const { useCases } = await getRacingServices();
		const setup = await useCases.getSetup.execute(params.userId);
		return json(setup);
	} catch (error) {
		return toRacingErrorResponse(error);
	}
};

export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const { useCases } = await getRacingServices();
		const body = (await request.json()) as Racing.SetupValues;
		await useCases.setSetup.execute(params.userId, body);
		return json({ ok: true });
	} catch (error) {
		return toRacingErrorResponse(error);
	}
};
