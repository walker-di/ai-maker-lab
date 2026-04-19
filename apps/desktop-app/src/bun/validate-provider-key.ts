export type ProviderId = 'openai' | 'anthropic' | 'gemini';

export type ProviderValidationStatus = 'ok' | 'invalid' | 'network_error' | 'skipped';

export interface ProviderValidationResult {
	status: ProviderValidationStatus;
	message?: string;
}

const VALIDATION_TIMEOUT_MS = 5000;

/**
 * Probe each provider's lightest "are these credentials valid?" endpoint with
 * a 5 s timeout. The check is best-effort: a `network_error` does NOT mean the
 * key is wrong, only that we couldn't reach the provider (e.g. offline). The
 * Settings UI surfaces this as an "unverified" badge so users still get a
 * signal without the save being blocked by transient network failures.
 *
 * Endpoints chosen because they're documented, idempotent, and free:
 *   - OpenAI:    GET /v1/models           (Authorization: Bearer)
 *   - Anthropic: GET /v1/models           (x-api-key + anthropic-version)
 *   - Gemini:    GET /v1beta/models?key=  (key in query string)
 */
export async function validateProviderKey(
	provider: ProviderId,
	value: string,
	fetchImpl: typeof fetch = fetch,
): Promise<ProviderValidationResult> {
	if (!value || value.trim().length === 0) {
		return { status: 'skipped' };
	}

	try {
		const response = await fetchImpl(buildUrl(provider, value), {
			method: 'GET',
			headers: buildHeaders(provider, value),
			signal: AbortSignal.timeout(VALIDATION_TIMEOUT_MS),
		});

		if (response.ok) return { status: 'ok' };

		if (response.status === 401 || response.status === 403) {
			const detail = await readBriefError(response);
			return { status: 'invalid', message: detail ?? `HTTP ${response.status}` };
		}

		if (response.status === 400 && provider === 'gemini') {
			// Gemini returns 400 + INVALID_ARGUMENT for bad keys instead of 401.
			const detail = await readBriefError(response);
			return { status: 'invalid', message: detail ?? 'HTTP 400' };
		}

		const detail = await readBriefError(response);
		return {
			status: 'network_error',
			message: `HTTP ${response.status}${detail ? `: ${detail}` : ''}`,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return { status: 'network_error', message };
	}
}

function buildUrl(provider: ProviderId, value: string): string {
	switch (provider) {
		case 'openai':
			return 'https://api.openai.com/v1/models';
		case 'anthropic':
			return 'https://api.anthropic.com/v1/models';
		case 'gemini':
			return `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(value)}`;
	}
}

function buildHeaders(provider: ProviderId, value: string): Record<string, string> {
	switch (provider) {
		case 'openai':
			return { Authorization: `Bearer ${value}` };
		case 'anthropic':
			return { 'x-api-key': value, 'anthropic-version': '2023-06-01' };
		case 'gemini':
			return {};
	}
}

async function readBriefError(response: Response): Promise<string | undefined> {
	try {
		const text = await response.text();
		if (!text) return undefined;
		const trimmed = text.trim();
		return trimmed.length > 200 ? `${trimmed.slice(0, 200)}…` : trimmed;
	} catch {
		return undefined;
	}
}
