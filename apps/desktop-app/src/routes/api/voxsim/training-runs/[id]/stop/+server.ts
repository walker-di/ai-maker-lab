import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const prerender = false;

export const POST: RequestHandler = async () => {
	return json(
		{ error: 'Training run lifecycle is not wired in this build' },
		{ status: 501 }
	);
};
