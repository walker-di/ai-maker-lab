import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fileURLToPath } from 'node:url';
import { getMarketingServices, toMarketingErrorResponse } from '$lib/server/marketing-service';

export const prerender = false;

export const POST: RequestHandler = async ({ params }) => {
	try {
		const { storyboardService } = await getMarketingServices();
		const outputDir = process.env.MARKETING_ASSET_ROOT ??
			fileURLToPath(new URL('../../../../../../../data/marketing-assets', import.meta.url));
		return json(await storyboardService.exportUnifiedVideo(
			params.storyboardId,
			`${outputDir}/exports/storyboard-${params.storyboardId}.mp4`,
		));
	} catch (error) {
		console.error('Failed to export storyboard video', error);
		return toMarketingErrorResponse(error);
	}
};
