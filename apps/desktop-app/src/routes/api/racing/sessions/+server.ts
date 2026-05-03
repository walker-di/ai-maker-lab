import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRacingServices, toRacingErrorResponse } from '$lib/server/racing-service';

export const prerender = false;

interface StartSessionBody {
	trackId: string;
	vehicleId: string;
	sessionId?: string;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { useCases } = await getRacingServices();
		const body = (await request.json()) as StartSessionBody;
		return json(await useCases.startSession.execute(body));
	} catch (error) {
		return toRacingErrorResponse(error);
	}
};
