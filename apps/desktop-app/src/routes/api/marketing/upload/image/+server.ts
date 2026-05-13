import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMarketingServices, toMarketingErrorResponse } from '$lib/server/marketing-service';

export const prerender = false;

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { assetStorage } = await getMarketingServices();
		const formData = await request.formData();
		const file = formData.get('file') as File | null;
		if (!file) return json({ error: 'file is required' }, { status: 400 });
		const buffer = Buffer.from(await file.arrayBuffer());
		const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
		const result = await assetStorage.saveImage(buffer, filename);
		return json({ url: result.url }, { status: 201 });
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};
