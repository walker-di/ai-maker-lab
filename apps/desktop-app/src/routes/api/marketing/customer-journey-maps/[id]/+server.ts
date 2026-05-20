import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMarketingServices, toMarketingErrorResponse } from '$lib/server/marketing-service';
import { Marketing } from 'domain/shared';

export const prerender = false;

export const GET: RequestHandler = async ({ params }) => {
	try {
		const { customerJourneyMapService } = await getMarketingServices();
		const journeyMap = await customerJourneyMapService.get(params.id);
		if (!journeyMap) return json({ error: 'Customer journey map not found' }, { status: 404 });
		return json(journeyMap);
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};

export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const { customerJourneyMapService } = await getMarketingServices();
		const journeyMap = await customerJourneyMapService.get(params.id);
		if (!journeyMap) return json({ error: 'Customer journey map not found' }, { status: 404 });
		const parsed = Marketing.UpdateCustomerJourneyMapDtoSchema.safeParse(await request.json());
		if (!parsed.success) {
			return json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
		}
		return json(await customerJourneyMapService.update(params.id, parsed.data));
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const { customerJourneyMapService } = await getMarketingServices();
		const journeyMap = await customerJourneyMapService.get(params.id);
		if (!journeyMap) return json({ error: 'Customer journey map not found' }, { status: 404 });
		await customerJourneyMapService.delete(params.id);
		return json({ success: true });
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};
