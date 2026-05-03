import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRacingServices, toRacingErrorResponse } from '$lib/server/racing-service';
import type { Racing } from 'domain/shared';

export const prerender = false;

interface RecordLapBody {
	sessionId: string;
	trackId: string;
	vehicleId: string;
	lapMs: number;
	sectors?: ReadonlyArray<Racing.SectorTime>;
	finishedAt?: string;
}

export const GET: RequestHandler = async ({ params }) => {
	try {
		const { useCases } = await getRacingServices();
		const lap = await useCases.getBestLap.execute({
			trackId: params.trackId,
			vehicleId: params.vehicleId
		});
		return json(lap);
	} catch (error) {
		return toRacingErrorResponse(error);
	}
};

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const { useCases } = await getRacingServices();
		const body = (await request.json()) as RecordLapBody;
		const lap = await useCases.recordLap.execute({
			...body,
			trackId: params.trackId,
			vehicleId: params.vehicleId
		});
		return json(lap);
	} catch (error) {
		return toRacingErrorResponse(error);
	}
};
