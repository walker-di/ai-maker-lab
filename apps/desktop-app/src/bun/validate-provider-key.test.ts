import { describe, expect, it } from 'vitest';
import { validateProviderKey } from './validate-provider-key';

function fakeFetch(handler: (url: URL, init: RequestInit) => Response | Promise<Response>): typeof fetch {
	return (async (input: URL | RequestInfo, init: RequestInit = {}) => {
		const url = typeof input === 'string' ? new URL(input) : input instanceof URL ? input : new URL(input.url);
		return handler(url, init);
	}) as typeof fetch;
}

describe('validateProviderKey', () => {
	it('returns skipped when no value is supplied', async () => {
		const result = await validateProviderKey('openai', '');
		expect(result).toEqual({ status: 'skipped' });
	});

	it('returns ok for a 200 response on OpenAI', async () => {
		const fetchImpl = fakeFetch((url, init) => {
			expect(url.toString()).toBe('https://api.openai.com/v1/models');
			expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
			return new Response('{}', { status: 200 });
		});
		const result = await validateProviderKey('openai', 'sk-test', fetchImpl);
		expect(result.status).toBe('ok');
	});

	it('returns invalid for 401 on Anthropic', async () => {
		const fetchImpl = fakeFetch((url, init) => {
			expect(url.toString()).toBe('https://api.anthropic.com/v1/models');
			const headers = init.headers as Record<string, string>;
			expect(headers['x-api-key']).toBe('bad');
			expect(headers['anthropic-version']).toBe('2023-06-01');
			return new Response('unauthorized', { status: 401 });
		});
		const result = await validateProviderKey('anthropic', 'bad', fetchImpl);
		expect(result.status).toBe('invalid');
	});

	it('treats Gemini 400 as invalid (provider returns 400 for bad keys)', async () => {
		const fetchImpl = fakeFetch((url) => {
			expect(url.searchParams.get('key')).toBe('bad-gemini');
			return new Response('{"error": {"code": 400}}', { status: 400 });
		});
		const result = await validateProviderKey('gemini', 'bad-gemini', fetchImpl);
		expect(result.status).toBe('invalid');
	});

	it('returns network_error when fetch throws', async () => {
		const fetchImpl = (async () => {
			throw new Error('ECONNREFUSED');
		}) as unknown as typeof fetch;
		const result = await validateProviderKey('openai', 'sk-x', fetchImpl);
		expect(result.status).toBe('network_error');
		expect(result.message).toContain('ECONNREFUSED');
	});

	it('returns network_error for 5xx responses (provider outage)', async () => {
		const fetchImpl = fakeFetch(() => new Response('boom', { status: 503 }));
		const result = await validateProviderKey('openai', 'sk-x', fetchImpl);
		expect(result.status).toBe('network_error');
		expect(result.message).toContain('503');
	});
});
