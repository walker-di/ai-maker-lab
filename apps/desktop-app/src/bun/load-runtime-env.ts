import { join } from 'node:path';
import { Utils } from 'electrobun/bun';
import { SECRETS_FILENAME, SecretsStore, snapshotShellEnvKeys } from './secrets-store';

const WELL_KNOWN_KEYS = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY'] as const;

export type WellKnownEnvKey = (typeof WELL_KNOWN_KEYS)[number];

export const PROVIDER_KEY_LIST: readonly WellKnownEnvKey[] = WELL_KNOWN_KEYS;

export interface LoadRuntimeEnvResult {
	store: SecretsStore;
	shellSnapshot: ReadonlySet<string>;
	loaded: string[];
	missing: string[];
}

/**
 * Hydrate `process.env` from the per-channel `secrets.env` so that production
 * `.app` builds (which launchd starts without inheriting the user's shell
 * environment) can still see provider API keys. Returns the configured
 * `SecretsStore` so downstream code (Settings RPC) operates on the same path
 * and shell snapshot.
 *
 * Must be called BEFORE any module that reads provider keys
 * (`buildProviderRegistry`, etc.).
 */
export function loadRuntimeEnv(): LoadRuntimeEnvResult {
	// Snapshot which well-known keys came from the user's shell BEFORE we
	// mirror file values in. SecretsStore uses this to label key sources in
	// the Settings UI and to decide whether deletes can clear `process.env`.
	const shellSnapshot = snapshotShellEnvKeys(WELL_KNOWN_KEYS);
	const secretsPath = join(Utils.paths.userData, SECRETS_FILENAME);
	const store = new SecretsStore({ secretsPath, shellSnapshot });

	const created = store.ensureTemplate();
	if (created) {
		console.warn(
			`[env] No secrets file found. Created template at:\n  ${store.secretsPath}\n` +
				`[env] Add your provider keys (${WELL_KNOWN_KEYS.join(', ')}) and restart the app, ` +
				`or set them from the in-app Settings page.`,
		);
	}

	const fileValues = store.read();
	const loaded: string[] = [];
	for (const [key, value] of Object.entries(fileValues)) {
		const existing = process.env[key];
		if (existing !== undefined && existing !== '') continue;
		process.env[key] = value;
		loaded.push(key);
	}

	if (loaded.length > 0) {
		console.log(`[env] Loaded ${loaded.length} secret(s) from ${store.secretsPath}: ${loaded.join(', ')}`);
	}

	const missing = WELL_KNOWN_KEYS.filter((key) => {
		const v = process.env[key];
		return v === undefined || v === '';
	});
	if (missing.length > 0) {
		console.warn(
			`[env] Missing provider key(s): ${missing.join(', ')}. ` +
				`Add them via the Settings page or edit ${store.secretsPath} and restart.`,
		);
	}

	return { store, shellSnapshot, loaded, missing };
}
