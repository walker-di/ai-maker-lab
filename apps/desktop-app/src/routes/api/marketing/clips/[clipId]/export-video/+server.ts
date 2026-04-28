import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMarketingServices, toMarketingErrorResponse } from '$lib/server/marketing-service';
import { fileURLToPath } from 'node:url';

export const prerender = false;

export const POST: RequestHandler = async ({ params }) => {
	try {
		const { videoExportService } = await getMarketingServices();
		const outputDir = process.env.MARKETING_ASSET_ROOT ??
			fileURLToPath(new URL('../../../../../../../data/marketing-assets', import.meta.url));
		const result = await videoExportService.exportClip(
			params.clipId,
			`${outputDir}/exports/clip-${params.clipId}.mp4`,
		);
		return json(result);
	} catch (error) {
		return toMarketingErrorResponse(error);
	}
};
