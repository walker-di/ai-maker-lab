import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRtsServices, toRtsErrorResponse } from '$lib/server/rts-service';
import { Rts } from 'domain/application';
import type { Rts as RtsShared } from 'domain/shared';

export const prerender = false;

export const GET: RequestHandler = async ({ url }) => {
	try {
		const { matchResults } = await getRtsServices();
		const useCase = Rts.createListMatchResults(matchResults);
		const filter: RtsShared.ListMatchResultsFilter = {
			mapId: url.searchParams.get('mapId') ?? undefined,
			winner: url.searchParams.get('winner') ?? undefined,
			since: url.searchParams.get('since') ?? undefined,
			until: url.searchParams.get('until') ?? undefined,
			limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined
		};
		return json(await useCase.execute(filter));
	} catch (error) {
		return toRtsErrorResponse(error);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { matchResults } = await getRtsServices();
		const useCase = Rts.createRecordMatchResult(matchResults);
		const body = (await request.json()) as RtsShared.MatchResult;
		return json(await useCase.execute(body));
	} catch (error) {
		return toRtsErrorResponse(error);
	}
};
