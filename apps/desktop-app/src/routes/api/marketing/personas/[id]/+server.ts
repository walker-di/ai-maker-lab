import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMarketingServices, toMarketingErrorResponse } from '$lib/server/marketing-service';
import { Marketing } from 'domain/shared';

export const prerender = false;

export const GET: RequestHandler = async ({ params }) => {
	try {
		const { personaService } = await getMarketingServices();
		const persona = await personaService.get(params.id);
		if (!persona) return json({ error: 'Persona not found' }, { status: 404 });
		return json(persona);
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};

export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const { personaService } = await getMarketingServices();
		const persona = await personaService.get(params.id);
		if (!persona) return json({ error: 'Persona not found' }, { status: 404 });
		const parsed = Marketing.UpdatePersonaDtoSchema.safeParse(await request.json());
		if (!parsed.success) {
			return json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
		}
		return json(await personaService.update(params.id, parsed.data));
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const { personaService } = await getMarketingServices();
		const persona = await personaService.get(params.id);
		if (!persona) return json({ error: 'Persona not found' }, { status: 404 });
		await personaService.delete(params.id);
		return json({ success: true });
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};
