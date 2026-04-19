import { describe, expect, test, vi } from 'vitest';
import { flushSync } from 'svelte';
import type { SettingsTransport } from '$lib/adapters/settings/SettingsTransport';
import type {
	ProviderKeyStatus,
	SetProviderKeysParams,
	SetProviderKeysResponse,
} from '$lib/adapters/settings/electrobun-settings-rpc';
import { createSettingsPageModel } from './settings-page.svelte.ts';

function makeStatus(overrides: Partial<ProviderKeyStatus> & { provider: ProviderKeyStatus['provider'] }): ProviderKeyStatus {
	return {
		isSet: false,
		source: 'unset',
		preview: null,
		...overrides,
	};
}

function makeTransport(overrides: Partial<SettingsTransport> = {}): SettingsTransport {
	return {
		mode: 'desktop',
		getProviderKeyStatus: vi
			.fn<() => Promise<ProviderKeyStatus[]>>()
			.mockResolvedValue([
				makeStatus({ provider: 'openai' }),
				makeStatus({ provider: 'anthropic' }),
				makeStatus({ provider: 'gemini' }),
			]),
		setProviderKeys: vi
			.fn<(params: SetProviderKeysParams) => Promise<SetProviderKeysResponse>>()
			.mockResolvedValue({
				statuses: [],
				validations: { openai: { status: 'ok' }, anthropic: { status: 'skipped' }, gemini: { status: 'skipped' } },
			}),
		...overrides,
	};
}

describe('createSettingsPageModel', () => {
	test('load fetches statuses and marks hasLoaded', async () => {
		const transport = makeTransport();
		const model = createSettingsPageModel({ transport });

		const ok = await model.load();
		flushSync();

		expect(ok).toBe(true);
		expect(model.hasLoaded).toBe(true);
		expect(model.statuses.map((s) => s.provider)).toEqual(['openai', 'anthropic', 'gemini']);
		expect(transport.getProviderKeyStatus).toHaveBeenCalledTimes(1);
	});

	test('save with no drafts is a noop and does not call the transport', async () => {
		const transport = makeTransport();
		const model = createSettingsPageModel({ transport });

		const outcome = await model.save();
		expect(outcome).toEqual({ kind: 'noop' });
		expect(transport.setProviderKeys).not.toHaveBeenCalled();
	});

	test('save sends only dirty drafts and clears them on ok', async () => {
		const transport = makeTransport({
			setProviderKeys: vi
				.fn<(p: SetProviderKeysParams) => Promise<SetProviderKeysResponse>>()
				.mockResolvedValue({
					statuses: [
						makeStatus({ provider: 'openai', isSet: true, source: 'file', preview: 'sk-...abcd' }),
						makeStatus({ provider: 'anthropic' }),
						makeStatus({ provider: 'gemini' }),
					],
					validations: {
						openai: { status: 'ok' },
						anthropic: { status: 'skipped' },
						gemini: { status: 'skipped' },
					},
				}),
		});
		const model = createSettingsPageModel({ transport });

		model.setDraft('openai', 'sk-good');
		flushSync();

		const outcome = await model.save();
		flushSync();

		expect(outcome).toEqual({ kind: 'success' });
		expect(transport.setProviderKeys).toHaveBeenCalledWith({
			entries: [{ provider: 'openai', value: 'sk-good' }],
		});
		expect(model.drafts.openai).toBeUndefined();
		expect(model.validations.openai).toEqual({ status: 'ok' });
		const openaiStatus = model.statuses.find((s) => s.provider === 'openai');
		expect(openaiStatus?.isSet).toBe(true);
		expect(openaiStatus?.source).toBe('file');
	});

	test('invalid validations keep their dirty draft so the user can fix them', async () => {
		const transport = makeTransport({
			setProviderKeys: vi
				.fn<(p: SetProviderKeysParams) => Promise<SetProviderKeysResponse>>()
				.mockResolvedValue({
					statuses: [
						makeStatus({ provider: 'openai', isSet: true, source: 'file', preview: 'sk-...badd' }),
						makeStatus({ provider: 'anthropic', isSet: true, source: 'file', preview: 'sk-...okok' }),
						makeStatus({ provider: 'gemini' }),
					],
					validations: {
						openai: { status: 'invalid', message: '401' },
						anthropic: { status: 'ok' },
						gemini: { status: 'skipped' },
					},
				}),
		});
		const model = createSettingsPageModel({ transport });

		model.setDraft('openai', 'sk-bad');
		model.setDraft('anthropic', 'sk-good');
		flushSync();

		const outcome = await model.save();
		flushSync();

		expect(outcome).toEqual({ kind: 'mixed' });
		expect(model.drafts.openai).toBe('sk-bad');
		expect(model.drafts.anthropic).toBeUndefined();
		expect(model.validations.openai).toEqual({ status: 'invalid', message: '401' });
		expect(model.validations.anthropic).toEqual({ status: 'ok' });
	});

	test('network_error becomes an unverified validation badge', async () => {
		const transport = makeTransport({
			setProviderKeys: vi
				.fn<(p: SetProviderKeysParams) => Promise<SetProviderKeysResponse>>()
				.mockResolvedValue({
					statuses: [
						makeStatus({ provider: 'openai', isSet: true, source: 'file', preview: 'sk-...abcd' }),
						makeStatus({ provider: 'anthropic' }),
						makeStatus({ provider: 'gemini' }),
					],
					validations: {
						openai: { status: 'network_error', message: 'offline' },
						anthropic: { status: 'skipped' },
						gemini: { status: 'skipped' },
					},
				}),
		});
		const model = createSettingsPageModel({ transport });

		model.setDraft('openai', 'sk-x');
		flushSync();

		await model.save();
		flushSync();

		expect(model.validations.openai).toEqual({ status: 'unverified', message: 'offline' });
		expect(model.drafts.openai).toBeUndefined();
	});

	test('thrown transport errors surface via errorMessage and lastSaveOutcome.failed', async () => {
		const transport = makeTransport({
			setProviderKeys: vi.fn(async () => {
				throw new Error('boom');
			}),
		});
		const model = createSettingsPageModel({ transport });

		model.setDraft('openai', 'sk-x');
		flushSync();

		const outcome = await model.save();
		flushSync();

		expect(outcome.kind).toBe('failed');
		if (outcome.kind === 'failed') {
			expect(outcome.reason).toBe('boom');
		}
		expect(model.errorMessage).toBe('boom');
	});

	test('setDraft clears any prior validation for that provider', async () => {
		const transport = makeTransport();
		const model = createSettingsPageModel({ transport });

		model.setDraft('openai', 'sk-x');
		flushSync();
		await model.save();
		flushSync();

		expect(model.validations.openai).toBeDefined();
		model.setDraft('openai', 'sk-y');
		flushSync();
		expect(model.validations.openai).toBeUndefined();
	});
});
