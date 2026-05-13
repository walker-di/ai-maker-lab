import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const prerender = false;

const ALLOWED_KINDS = new Set(['images', 'audio', 'exports']);

export const GET: RequestHandler = async ({ params }) => {
	if (!ALLOWED_KINDS.has(params.kind)) throw error(404, 'Asset not found');
	const filename = path.basename(params.filename);
	if (filename !== params.filename) throw error(400, 'Invalid asset filename');

	const assetRoot = process.env.MARKETING_ASSET_ROOT ??
		fileURLToPath(new URL('../../../../../../../data/marketing-assets', import.meta.url));
	const filePath = path.join(assetRoot, params.kind, filename);

	let buffer: Buffer;
	try {
		buffer = await fs.readFile(filePath);
	} catch {
		throw error(404, 'Asset not found');
	}

	const body = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
	return new Response(body, {
		headers: {
			'content-type': contentTypeFor(filename, params.kind),
			'cache-control': 'public, max-age=31536000, immutable',
			'X-Content-Type-Options': 'nosniff',
		},
	});
};

function contentTypeFor(filename: string, kind: string): string {
	const ext = path.extname(filename).toLowerCase();
	if (ext === '.mp3') return 'audio/mpeg';
	if (ext === '.wav') return 'audio/wav';
	if (ext === '.m4a') return 'audio/mp4';
	if (ext === '.png') return 'image/png';
	if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
	if (ext === '.webp') return 'image/webp';
	if (ext === '.gif') return 'image/gif';
	if (ext === '.svg') return 'image/svg+xml';
	if (ext === '.mp4') return 'video/mp4';
	return kind === 'audio' ? 'application/octet-stream' : 'application/octet-stream';
}
