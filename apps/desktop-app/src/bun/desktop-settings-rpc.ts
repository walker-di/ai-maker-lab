import { buildProviderRegistry } from 'domain/infrastructure';
import {
	PROVIDER_IDS,
	type ProviderId,
	type ProviderKeyStatus,
	type ProviderValidationResult,
	type SettingsRpcSchema,
} from '../lib/adapters/settings/electrobun-settings-rpc';
import type { ProviderRegistryRef } from './bootstrap-services';
import type { SecretsStore } from './secrets-store';
import { validateProviderKey, type ProviderId as ValidatorProviderId } from './validate-provider-key';

type RequestSchemaShape = Record<string, { params?: unknown; response: unknown }>;

type RequestHandlers<RS extends RequestSchemaShape> = {
	[K in keyof RS]: (
		...args: 'params' extends keyof RS[K]
			? undefined extends RS[K]['params']
				? [params?: RS[K]['params']]
				: [params: RS[K]['params']]
			: []
	) => Promise<Awaited<RS[K]['response']>>;
};

export type SettingsRequestHandlers = RequestHandlers<SettingsRpcSchema['bun']['requests']>;

const PROVIDER_TO_ENV_KEY: Record<ProviderId, string> = {
	openai: 'OPENAI_API_KEY',
	anthropic: 'ANTHROPIC_API_KEY',
	gemini: 'GEMINI_API_KEY',
};

const ENV_KEYS: readonly string[] = PROVIDER_IDS.map((p) => PROVIDER_TO_ENV_KEY[p]);

export interface SettingsRequestHandlerDeps {
	secretsStore: SecretsStore;
	providerRegistryRef: ProviderRegistryRef;
	/** Override the validator; defaults to the live HTTPS probe. */
	validate?: (provider: ProviderId, value: string) => Promise<ProviderValidationResult>;
	/** Override the registry rebuilder; defaults to `buildProviderRegistry`. */
	rebuildRegistry?: () => ProviderRegistryRef['current'];
}

/**
 * Build the Settings RPC handlers.
 *
 * `setProviderKeys` flow on save:
 *   1. Allowlist-check the provider IDs (drop unknowns).
 *   2. Persist the deltas via `secretsStore.update`. The store mirrors values
 *      into `process.env` so `buildProviderRegistry` reads fresh keys.
 *   3. Hot-swap `providerRegistryRef.current` with a new registry, taking
 *      effect on the very next chat request.
 *   4. Probe each non-empty entry against the provider's models endpoint in
 *      parallel; surface per-provider validation back to the renderer so the
 *      UI can flag invalid / unverified keys without blocking the save.
 */
export function buildSettingsRequestHandlers(
	deps: SettingsRequestHandlerDeps,
): SettingsRequestHandlers {
	const {
		secretsStore,
		providerRegistryRef,
		validate = (provider, value) => validateProviderKey(provider as ValidatorProviderId, value),
		rebuildRegistry = () => buildProviderRegistry(),
	} = deps;

	return {
		async getProviderKeyStatus() {
			return mapStatuses(secretsStore);
		},

		async setProviderKeys({ entries }) {
			const allowed = entries.filter((entry): entry is { provider: ProviderId; value: string } =>
				PROVIDER_IDS.includes(entry.provider as ProviderId),
			);

			const updates: Record<string, string> = {};
			for (const entry of allowed) {
				updates[PROVIDER_TO_ENV_KEY[entry.provider]] = entry.value;
			}

			if (Object.keys(updates).length > 0) {
				secretsStore.update(updates);
				providerRegistryRef.current = rebuildRegistry();
			}

			const validationEntries = await Promise.all(
				PROVIDER_IDS.map(async (provider): Promise<[ProviderId, ProviderValidationResult]> => {
					const supplied = allowed.find((entry) => entry.provider === provider);
					if (!supplied) return [provider, { status: 'skipped' }];
					if (supplied.value === '') return [provider, { status: 'skipped' }];
					try {
						const result = await validate(provider, supplied.value);
						return [provider, result];
					} catch (error) {
						const message = error instanceof Error ? error.message : String(error);
						return [provider, { status: 'network_error', message }];
					}
				}),
			);

			const validations = Object.fromEntries(validationEntries) as Record<
				ProviderId,
				ProviderValidationResult
			>;

			return {
				statuses: mapStatuses(secretsStore),
				validations,
			};
		},
	};
}

function mapStatuses(secretsStore: SecretsStore): ProviderKeyStatus[] {
	const rows = secretsStore.getStatus(ENV_KEYS);
	return PROVIDER_IDS.map((provider) => {
		const envKey = PROVIDER_TO_ENV_KEY[provider];
		const row = rows.find((r) => r.key === envKey);
		return {
			provider,
			isSet: row?.isSet ?? false,
			source: row?.source ?? 'unset',
			preview: row?.preview ?? null,
		};
	});
}
