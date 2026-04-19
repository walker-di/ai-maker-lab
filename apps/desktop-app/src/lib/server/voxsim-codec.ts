/**
 * Server-side helpers for the binary envelope used by `web-voxsim-transport`.
 * Both sides serialize `Uint8Array` payloads as `{ __bin__: 'base64', data }`
 * so they round-trip through JSON without needing multipart/form-data.
 */

export function encodeVoxsimJson(value: unknown): string {
	return JSON.stringify(value, (_key, val) => {
		if (val instanceof Uint8Array) {
			return { __bin__: 'base64', data: bytesToBase64(val) };
		}
		return val;
	});
}

export function decodeVoxsimJson<T>(text: string): T {
	return JSON.parse(text, (_key, val) => {
		if (
			val &&
			typeof val === 'object' &&
			!Array.isArray(val) &&
			(val as { __bin__?: unknown }).__bin__ === 'base64' &&
			typeof (val as { data?: unknown }).data === 'string'
		) {
			return base64ToBytes((val as { data: string }).data);
		}
		return val;
	}) as T;
}

export async function readVoxsimJson<T>(request: Request): Promise<T> {
	const text = await request.text();
	return decodeVoxsimJson<T>(text);
}

export function jsonWithBytes(value: unknown, init?: ResponseInit): Response {
	return new Response(encodeVoxsimJson(value), {
		...init,
		headers: {
			...(init?.headers ?? {}),
			'content-type': 'application/json'
		}
	});
}

function bytesToBase64(bytes: Uint8Array): string {
	return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
}

function base64ToBytes(b64: string): Uint8Array {
	const buf = Buffer.from(b64, 'base64');
	return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}
