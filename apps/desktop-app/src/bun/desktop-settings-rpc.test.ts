import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SecretsStore, snapshotShellEnvKeys } from './secrets-store';
import { buildSettingsRequestHandlers } from './desktop-settings-rpc';
import type { ProviderRegistryRef } from './bootstrap-services';
import type {
	ProviderId,
	ProviderValidationResult,
} from '../lib/adapters/settings/electrobun-settings-rpc';
import type { ProviderRegistry } from 'domain/infrastructure';

function makeRegistry(): ProviderRegistry {
	return { languageModel: vi.fn() } as unknown as ProviderRegistry;
}

describe('buildSettingsRequestHandlers', () => {
	let dir: string;
	let store: SecretsStore;
	let registryRef: ProviderRegistryRef;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), 'aml-settings-rpc-'));
		delete process.env.OPENAI_API_KEY;
		delete process.env.ANTHROPIC_API_KEY;
		delete process.env.GEMINI_API_KEY;
		store = new SecretsStore({
			secretsPath: join(dir, 'secrets.env'),
			shellSnapshot: snapshotShellEnvKeys(['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY']),
		});
		registryRef = { current: makeRegistry() };
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
		delete process.env.OPENAI_API_KEY;
		delete process.env.ANTHROPIC_API_KEY;
		delete process.env.GEMINI_API_KEY;
	});

	it('getProviderKeyStatus returns one row per known provider', async () => {
		const handlers = buildSettingsRequestHandlers({
			secretsStore: store,
			providerRegistryRef: registryRef,
			validate: async () => ({ status: 'ok' }),
			rebuildRegistry: () => makeRegistry(),
		});

		const statuses = await handlers.getProviderKeyStatus();
		expect(statuses.map((s) => s.provider)).toEqual(['openai', 'anthropic', 'gemini']);
		for (const s of statuses) expect(s.isSet).toBe(false);
	});

	it('setProviderKeys persists, hot-rebuilds the registry, and returns validation per provider', async () => {
		const validate = vi.fn(
			async (provider: ProviderId, value: string): Promise<ProviderValidationResult> => {
				if (provider === 'openai' && value === 'sk-good') return { status: 'ok' };
				return { status: 'invalid', message: 'bad' };
			},
		);
		const newRegistry = makeRegistry();
		const rebuildRegistry = vi.fn(() => newRegistry);

		const handlers = buildSettingsRequestHandlers({
			secretsStore: store,
			providerRegistryRef: registryRef,
			validate,
			rebuildRegistry,
		});

		const result = await handlers.setProviderKeys({
			entries: [
				{ provider: 'openai', value: 'sk-good' },
				{ provider: 'anthropic', value: 'sk-bad' },
			],
		});

		expect(rebuildRegistry).toHaveBeenCalledTimes(1);
		expect(registryRef.current).toBe(newRegistry);
		expect(process.env.OPENAI_API_KEY).toBe('sk-good');
		expect(process.env.ANTHROPIC_API_KEY).toBe('sk-bad');
		expect(result.validations.openai).toEqual({ status: 'ok' });
		expect(result.validations.anthropic).toEqual({ status: 'invalid', message: 'bad' });
		expect(result.validations.gemini).toEqual({ status: 'skipped' });
		const openai = result.statuses.find((s) => s.provider === 'openai');
		expect(openai?.isSet).toBe(true);
		expect(openai?.source).toBe('file');
	});

	it('drops unknown provider IDs from the input (allowlist)', async () => {
		const validate = vi.fn(async (): Promise<ProviderValidationResult> => ({ status: 'ok' }));
		const handlers = buildSettingsRequestHandlers({
			secretsStore: store,
			providerRegistryRef: registryRef,
			validate,
			rebuildRegistry: () => makeRegistry(),
		});

		await handlers.setProviderKeys({
			entries: [
				// @ts-expect-error testing allowlist enforcement
				{ provider: 'rogue', value: 'x' },
				{ provider: 'openai', value: 'sk-x' },
			],
		});

		expect(process.env.OPENAI_API_KEY).toBe('sk-x');
		expect(process.env.ROGUE).toBeUndefined();
	});

	it('treats validator throws as network_error', async () => {
		const handlers = buildSettingsRequestHandlers({
			secretsStore: store,
			providerRegistryRef: registryRef,
			validate: async () => {
				throw new Error('boom');
			},
			rebuildRegistry: () => makeRegistry(),
		});

		const result = await handlers.setProviderKeys({
			entries: [{ provider: 'openai', value: 'sk-x' }],
		});

		expect(result.validations.openai.status).toBe('network_error');
		expect(result.validations.openai.message).toContain('boom');
	});
});
