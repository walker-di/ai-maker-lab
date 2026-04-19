/**
 * RPC schema for the Settings page. The renderer asks the bun side for the
 * current provider key status (which keys are set, where they came from, and a
 * masked preview) and pushes user-edited values back as `setProviderKeys`.
 *
 * Secret values flow ONLY in the renderer-to-bun direction. Responses contain
 * masked previews and metadata, never raw values.
 */

export type ProviderId = 'openai' | 'anthropic' | 'gemini';

export const PROVIDER_IDS: readonly ProviderId[] = ['openai', 'anthropic', 'gemini'];

export type ProviderKeySource = 'shell' | 'file' | 'unset';

export interface ProviderKeyStatus {
	provider: ProviderId;
	isSet: boolean;
	source: ProviderKeySource;
	preview: string | null;
}

export type ProviderValidationStatus = 'ok' | 'invalid' | 'network_error' | 'skipped';

export interface ProviderValidationResult {
	status: ProviderValidationStatus;
	message?: string;
}

export interface SetProviderKeysParams {
	entries: Array<{ provider: ProviderId; value: string }>;
}

export interface SetProviderKeysResponse {
	statuses: ProviderKeyStatus[];
	validations: Record<ProviderId, ProviderValidationResult>;
}

export type SettingsRpcSchema = {
	bun: {
		requests: {
			getProviderKeyStatus: { params: undefined; response: ProviderKeyStatus[] };
			setProviderKeys: { params: SetProviderKeysParams; response: SetProviderKeysResponse };
		};
		messages: {};
	};
	webview: {
		requests: {};
		messages: {};
	};
};
