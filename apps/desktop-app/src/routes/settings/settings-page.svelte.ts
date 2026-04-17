import { SETTINGS_PROVIDER_IDS } from 'ui/source';
import type {
	SettingsProviderId,
	SettingsProviderKeyStatus,
	SettingsProviderValidation,
} from 'ui/source';
import type { SettingsTransport } from '$lib/adapters/settings/SettingsTransport';

export interface SettingsPageModelInput {
	transport: SettingsTransport;
}

export type SaveOutcome =
	| { kind: 'noop' }
	| { kind: 'success' }
	| { kind: 'mixed' }
	| { kind: 'failed'; reason: string };

function emptyStatuses(): SettingsProviderKeyStatus[] {
	return SETTINGS_PROVIDER_IDS.map((provider) => ({
		provider,
		isSet: false,
		source: 'unset',
		preview: null,
	}));
}

/**
 * State + behaviours for the Settings page. Owns drafts (per-provider value
 * strings the user has edited but not yet saved), per-provider validation
 * results from the most recent save, and the load/save lifecycle.
 *
 * After a save:
 *   - `ok` and `unverified` providers have their drafts cleared (the textbox
 *     reverts to showing the masked preview from the new status).
 *   - `invalid` providers keep their dirty draft so the user can fix it.
 */
export function createSettingsPageModel({ transport }: SettingsPageModelInput) {
	let statuses = $state<SettingsProviderKeyStatus[]>(emptyStatuses());
	let drafts = $state<Partial<Record<SettingsProviderId, string>>>({});
	let validations = $state<Partial<Record<SettingsProviderId, SettingsProviderValidation>>>({});
	let isLoading = $state(false);
	let isSaving = $state(false);
	let hasLoaded = $state(false);
	let errorMessage = $state<string | null>(null);
	let lastSaveOutcome = $state<SaveOutcome | null>(null);

	const hasDirtyDraft = $derived(
		Object.values(drafts).some((value) => value !== undefined),
	);

	async function load(): Promise<boolean> {
		isLoading = true;
		errorMessage = null;
		try {
			const result = await transport.getProviderKeyStatus();
			const byProvider = new Map(result.map((s) => [s.provider, s]));
			statuses = SETTINGS_PROVIDER_IDS.map(
				(provider) =>
					byProvider.get(provider) ?? {
						provider,
						isSet: false,
						source: 'unset' as const,
						preview: null,
					},
			);
			hasLoaded = true;
			return true;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : String(error);
			return false;
		} finally {
			isLoading = false;
		}
	}

	function setDraft(provider: SettingsProviderId, value: string) {
		drafts = { ...drafts, [provider]: value };
		if (validations[provider]) {
			const next = { ...validations };
			delete next[provider];
			validations = next;
		}
	}

	function clearDraft(provider: SettingsProviderId) {
		const next = { ...drafts };
		delete next[provider];
		drafts = next;
	}

	function dismissError() {
		errorMessage = null;
	}

	async function save(): Promise<SaveOutcome> {
		const entries = SETTINGS_PROVIDER_IDS.flatMap((provider) => {
			const value = drafts[provider];
			if (value === undefined) return [];
			return [{ provider, value }];
		});

		if (entries.length === 0) {
			lastSaveOutcome = { kind: 'noop' };
			return lastSaveOutcome;
		}

		isSaving = true;
		errorMessage = null;
		try {
			const response = await transport.setProviderKeys({ entries });
			statuses = response.statuses;

			const nextValidations: Partial<Record<SettingsProviderId, SettingsProviderValidation>> = {};
			let invalidCount = 0;
			let okCount = 0;
			let unverifiedCount = 0;

			for (const { provider } of entries) {
				const result = response.validations[provider];
				if (!result) continue;
				if (result.status === 'ok') {
					okCount += 1;
					nextValidations[provider] = { status: 'ok' };
				} else if (result.status === 'invalid') {
					invalidCount += 1;
					nextValidations[provider] = { status: 'invalid', message: result.message };
				} else if (result.status === 'network_error') {
					unverifiedCount += 1;
					nextValidations[provider] = { status: 'unverified', message: result.message };
				}
			}
			validations = nextValidations;

			const nextDrafts: Partial<Record<SettingsProviderId, string>> = {};
			for (const { provider, value } of entries) {
				const result = response.validations[provider];
				if (result?.status === 'invalid') {
					nextDrafts[provider] = value;
				}
			}
			drafts = nextDrafts;

			const outcome: SaveOutcome =
				invalidCount > 0 ? { kind: 'mixed' } : { kind: 'success' };
			lastSaveOutcome = outcome;
			void okCount;
			void unverifiedCount;
			return outcome;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			errorMessage = message;
			lastSaveOutcome = { kind: 'failed', reason: message };
			return lastSaveOutcome;
		} finally {
			isSaving = false;
		}
	}

	return {
		get statuses() {
			return statuses;
		},
		get drafts() {
			return drafts;
		},
		get validations() {
			return validations;
		},
		get isLoading() {
			return isLoading;
		},
		get isSaving() {
			return isSaving;
		},
		get hasLoaded() {
			return hasLoaded;
		},
		get errorMessage() {
			return errorMessage;
		},
		get hasDirtyDraft() {
			return hasDirtyDraft;
		},
		get lastSaveOutcome() {
			return lastSaveOutcome;
		},
		get mode(): SettingsTransport['mode'] {
			return transport.mode;
		},
		load,
		setDraft,
		clearDraft,
		dismissError,
		save,
	};
}

export type SettingsPageModel = ReturnType<typeof createSettingsPageModel>;
